import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';

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

  return new Response(JSON.stringify({ data }), {
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

  const { error } = await supabase
    .from('users_profile')
    .delete()
    .eq('id', userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
