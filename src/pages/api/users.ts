import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';
import { supabaseAdmin } from '../../lib/supabase';
import { sendEmail, PUBLIC_APP_URL } from '../../lib/email';
import { adminInviteEmail } from '../../lib/email-templates';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Only super admins can create admin accounts' }), { status: 403 });
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: 'Admin client not configured' }), { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'A valid email is required' }), { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('users_profile')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ error: 'A user with this email already exists' }), { status: 400 });
  }

  const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createErr || !created?.user) {
    return new Response(JSON.stringify({ error: createErr?.message || 'Failed to create user' }), { status: 400 });
  }

  const now = new Date().toISOString();
  // Supabase auto-creates a users_profile row (role='user', status='pending') via a
  // DB trigger when the auth user is created, so this must be an upsert, not an insert.
  const { error: profileErr } = await supabaseAdmin.from('users_profile').upsert({
    id: created.user.id,
    email,
    role: 'admin',
    status: 'approved',
    invited_by: user.id,
    approved_by: user.id,
    approved_at: now,
  });

  if (profileErr) {
    // Roll back the auth user so we don't leave an orphaned account with no profile
    await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return new Response(JSON.stringify({ error: profileErr.message }), { status: 500 });
  }

  const { subject, html } = adminInviteEmail({
    login_url: `${PUBLIC_APP_URL}/login`,
    temp_password: tempPassword,
  });
  const sendResp = await sendEmail({ to: email, subject, html });

  try {
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action_type: 'admin_created',
      target_user: created.user.id,
      details: { email, timestamp: now },
    });
  } catch {}

  return new Response(JSON.stringify({
    success: true,
    email,
    emailed: sendResp.ok,
    email_error: sendResp.ok ? undefined : sendResp.error,
    temp_password: tempPassword,
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const supabase = await createAuthenticatedClient(cookies);

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Fetch all users
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let combined = data || [];

  // Surface auth accounts with no matching profile row — e.g. left behind by an
  // earlier delete that only removed the profile — so they can still be found
  // and fully removed instead of silently blocking their email from reuse.
  if (supabaseAdmin) {
    const profileIds = new Set(combined.map((u: any) => u.id));
    const orphans: any[] = [];
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data: pageData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listErr || !pageData?.users?.length) break;
      for (const authUser of pageData.users) {
        if (!profileIds.has(authUser.id)) {
          orphans.push({
            id: authUser.id,
            email: authUser.email,
            role: 'user',
            status: 'orphaned',
            created_at: authUser.created_at,
          });
        }
      }
      if (pageData.users.length < perPage) break;
      page += 1;
    }
    combined = [...combined, ...orphans];
  }

  return new Response(JSON.stringify({ data: combined }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const body = await request.json();
  const { userId, updates } = body;

  if (!userId || !updates) {
    return new Response(JSON.stringify({ error: 'Missing userId or updates' }), { status: 400 });
  }

  // Prevent modifying self
  if (userId === user.id) {
    return new Response(JSON.stringify({ error: 'Cannot modify your own account' }), { status: 400 });
  }

  // Only super_admin can change roles
  if (updates.role && profile.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Only super admins can change roles' }), { status: 403 });
  }

  // A plain admin can never modify a super_admin's account (status, role, etc.).
  // An orphaned account (no users_profile row) has no verifiable role, so treat
  // it the same as a super_admin and require super_admin to touch it.
  if (profile.role !== 'super_admin') {
    const { data: targetProfile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', userId)
      .single();

    if (!targetProfile || targetProfile.role === 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only super admins can modify this account' }), { status: 403 });
    }
  }

  const { error } = await supabase
    .from('users_profile')
    .update(updates)
    .eq('id', userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Log admin action
  try {
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action_type: 'user_updated',
      target_user: userId,
      details: { updates, timestamp: new Date().toISOString() }
    });
  } catch {}

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const DELETE: APIRoute = async ({ request, cookies, url }) => {
  const supabase = await createAuthenticatedClient(cookies);

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const userId = url.searchParams.get('id');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400 });
  }

  if (userId === user.id) {
    return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400 });
  }

  // A plain admin can never delete a super_admin account. An orphaned account
  // (no users_profile row) has no verifiable role, so treat it the same as a
  // super_admin and require super_admin to delete it.
  if (profile.role !== 'super_admin') {
    const { data: targetProfile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', userId)
      .single();

    if (!targetProfile || targetProfile.role === 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only super admins can delete this account' }), { status: 403 });
    }
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: 'Admin client not configured' }), { status: 500 });
  }

  // admin_actions.admin_id / target_user reference auth.users(id) without ON DELETE
  // CASCADE, so the auth user can't be removed while an audit row still points to it.
  await supabaseAdmin
    .from('admin_actions')
    .delete()
    .or(`admin_id.eq.${userId},target_user.eq.${userId}`);

  const { error: profileError } = await supabaseAdmin
    .from('users_profile')
    .delete()
    .eq('id', userId);

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
