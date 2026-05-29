import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';
import { sendEmail, PUBLIC_APP_URL } from '../../lib/email';
import { companyInviteEmail } from '../../lib/email-templates';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';

  let query = supabase
    .from('companies')
    .select('*', { count: 'exact' })
    .order('name');

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,contact_person.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ data, count }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await request.json();
  const primaryEmail: string | null = body.email ? String(body.email).trim().toLowerCase() : null;
  const additionalEmails: string[] = Array.isArray(body.additional_emails)
    ? body.additional_emails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean)
    : [];

  if (!body.name || typeof body.name !== 'string') {
    return new Response(JSON.stringify({ error: 'Company name is required' }), { status: 400 });
  }

  // 1. Create the company row.
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .insert({
      name: body.name,
      email: primaryEmail,
      additional_emails: additionalEmails,
      phone: body.phone || null,
      address: body.address || null,
      contact_person: body.contact_person || null,
    })
    .select()
    .single();

  if (companyErr) {
    return new Response(JSON.stringify({ error: companyErr.message }), { status: 400 });
  }

  // 2. If a primary email was provided, provision a company user + send invite.
  let inviteResult: { sent: boolean; error?: string } = { sent: false };
  if (primaryEmail) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_company_user', {
      p_email: primaryEmail,
      p_company_id: company.id,
    });

    if (rpcErr) {
      // Company exists but user provisioning failed. Surface the error; admin can resend.
      inviteResult = { sent: false, error: rpcErr.message };
    } else {
      const setupToken = Array.isArray(rpcData) ? rpcData[0]?.setup_token : (rpcData as any)?.setup_token;
      const setupUrl = `${PUBLIC_APP_URL}/auth/setup?token=${encodeURIComponent(setupToken)}`;

      const { subject, html } = companyInviteEmail({
        company_name: company.name,
        setup_url: setupUrl,
      });

      const allRecipients = Array.from(new Set([primaryEmail, ...additionalEmails])).filter(Boolean);
      const emailResp = await sendEmail({ to: allRecipients, subject, html });
      inviteResult = { sent: emailResp.ok, error: emailResp.error };
    }
  }

  return new Response(JSON.stringify({ company, invite: inviteResult }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
