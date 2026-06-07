import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../../lib/supabase-server';
import { sendEmail, PUBLIC_APP_URL } from '../../../lib/email';
import { companyInviteEmail } from '../../../lib/email-templates';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'super_admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await request.json();
  const company_id: string | undefined = body.company_id;
  const emailInput: string | undefined = body.email;

  if (!company_id) {
    return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400 });
  }

  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id, name, email, additional_emails, user_id')
    .eq('id', company_id)
    .single();
  if (companyErr || !company) {
    return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404 });
  }

  if (company.user_id) {
    return new Response(JSON.stringify({ error: 'Company already has a linked user. Use resend-invite instead.' }), { status: 400 });
  }

  const primaryEmail = (emailInput || company.email || '').trim().toLowerCase();
  if (!primaryEmail) {
    return new Response(JSON.stringify({ error: 'Company has no email. Provide { email } to provision.' }), { status: 400 });
  }

  // Create auth user + profile for the company and generate setup token via secure RPC.
  const { data: rpcData, error: rpcErr } = await supabase.rpc('create_company_user', {
    p_email: primaryEmail,
    p_company_id: company.id,
  });
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), { status: 400 });
  }

  // Send setup email
  const setupToken = Array.isArray(rpcData) ? rpcData[0]?.setup_token : (rpcData as any)?.setup_token;
  const setupUrl = `${PUBLIC_APP_URL}/auth/setup?token=${encodeURIComponent(setupToken)}`;
  const { subject, html } = companyInviteEmail({ company_name: company.name, setup_url: setupUrl });
  const allRecipients = Array.from(new Set([primaryEmail, ...((company as any).additional_emails || [])])).filter(Boolean) as string[];
  const sendResp = await sendEmail({ to: allRecipients, subject, html });

  return new Response(JSON.stringify({ success: true, invited: sendResp.ok, error: sendResp.error, setup_url: setupUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
