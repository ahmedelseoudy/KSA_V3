import type { APIRoute } from 'astro';
import { createAuthenticatedClient } from '../../lib/supabase-server';
import {
  sendAvailabilityRequestEmail,
  sendDeliveryConfirmationEmail,
  sendPurchaseOrderEmail,
  sendTrackedEmail,
} from '../../lib/notifications';
import { companyInviteEmail } from '../../lib/email-templates';
import { PUBLIC_APP_URL } from '../../lib/email';

const FAILURE_STATUSES = ['failed', 'bounced', 'suppressed', 'complained'];
const MAX_RETRIES = 3;
const RETRY_COOLDOWN_MS = 60_000;

async function requireAdmin(cookies: Parameters<typeof createAuthenticatedClient>[0]) {
  const supabase = await createAuthenticatedClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, allowed: false };
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single();
  return {
    supabase,
    user,
    allowed: Boolean(profile && ['admin', 'super_admin'].includes(profile.role)),
  };
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth.user) return new Response('Unauthorized', { status: 401 });
  if (!auth.allowed) return new Response('Forbidden', { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('page_size')) || 25));
  const from = (page - 1) * pageSize;

  let query = auth.supabase
    .from('notifications')
    .select('*, company:companies(id, name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (status === 'attention') query = query.in('status', FAILURE_STATUSES);
  else if (status !== 'all') query = query.eq('status', status);

  const countFor = (statuses?: string[], requireProviderMessage = false) => {
    let countQuery = auth.supabase.from('notifications').select('id', { count: 'exact', head: true });
    if (statuses) countQuery = countQuery.in('status', statuses);
    if (requireProviderMessage) countQuery = countQuery.not('provider_message_id', 'is', null);
    return countQuery;
  };

  const [rowsResult, totalResult, attentionResult, deliveredResult, inFlightResult] = await Promise.all([
    query,
    countFor(),
    countFor(FAILURE_STATUSES),
    countFor(['delivered']),
    countFor(['pending', 'sent', 'delivery_delayed'], true),
  ]);
  if (rowsResult.error) {
    return new Response(JSON.stringify({ error: rowsResult.error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    data: rowsResult.data || [],
    count: rowsResult.count || 0,
    page,
    page_size: pageSize,
    summary: {
      total: totalResult.count || 0,
      attention: attentionResult.count || 0,
      delivered: deliveredResult.count || 0,
      in_flight: inFlightResult.count || 0,
    },
  }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth.user) return new Response('Unauthorized', { status: 401 });
  if (!auth.allowed) return new Response('Forbidden', { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (body.action !== 'retry' || !body.id) {
    return new Response(JSON.stringify({ error: 'action=retry and id are required' }), { status: 400 });
  }

  const { data: notification, error } = await auth.supabase
    .from('notifications')
    .select('*')
    .eq('id', String(body.id))
    .single();
  if (error || !notification) return new Response(JSON.stringify({ error: 'Notification not found' }), { status: 404 });
  if (!notification.retryable || !FAILURE_STATUSES.includes(notification.status)) {
    return new Response(JSON.stringify({ error: 'This notification is not eligible for retry' }), { status: 400 });
  }

  const retryRoot = notification.retry_of || notification.id;
  const { data: retryRows } = await auth.supabase
    .from('notifications')
    .select('created_at')
    .eq('retry_of', retryRoot)
    .order('created_at', { ascending: false });
  if ((retryRows || []).length >= MAX_RETRIES) {
    return new Response(JSON.stringify({ error: `Maximum of ${MAX_RETRIES} retries reached` }), { status: 429 });
  }
  const latestRetry = retryRows?.[0]?.created_at;
  if (latestRetry && Date.now() - Date.parse(latestRetry) < RETRY_COOLDOWN_MS) {
    return new Response(JSON.stringify({ error: 'Wait one minute before retrying again' }), { status: 429 });
  }

  const context = notification.context || {};
  const companyId = notification.company_id || '';
  const retryRecipient = String(body.recipient || notification.recipients?.[0] || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(retryRecipient)) {
    return new Response(JSON.stringify({ error: 'A valid retry recipient is required' }), { status: 400 });
  }
  let result;
  if (context.kind === 'availability_request') {
    result = await sendAvailabilityRequestEmail(auth.supabase, {
      company_id: companyId,
      availability_order_id: String(context.availability_order_id || ''),
      batch_name: String(context.batch_name || ''),
      item_count: Number(context.item_count || 0),
      retry_of: retryRoot,
      recipients_override: [retryRecipient],
    });
  } else if (context.kind === 'purchase_order') {
    result = await sendPurchaseOrderEmail(auth.supabase, {
      company_id: companyId,
      purchase_order_id: String(context.purchase_order_id || ''),
      po_number: String(context.po_number || ''),
      item_count: Number(context.item_count || 0),
      total_amount: Number(context.total_amount || 0),
      retry_of: retryRoot,
      recipients_override: [retryRecipient],
    });
  } else if (context.kind === 'delivery_update') {
    result = await sendDeliveryConfirmationEmail(auth.supabase, {
      company_id: companyId,
      purchase_order_id: String(context.purchase_order_id || ''),
      po_number: String(context.po_number || ''),
      delivered_count: Number(context.delivered_count || 0),
      total_items: Number(context.total_items || 0),
      is_complete: context.is_complete === true,
      retry_of: retryRoot,
      recipients_override: [retryRecipient],
    });
  } else if (context.kind === 'company_invite') {
    const { data: company } = await auth.supabase
      .from('companies')
      .select('id, name, email, additional_emails, user_id')
      .eq('id', companyId)
      .single();
    if (!company?.user_id || !company.email) {
      return new Response(JSON.stringify({ error: 'Company user or primary email is missing' }), { status: 400 });
    }
    const { data: token, error: tokenError } = await auth.supabase.rpc('regenerate_setup_token', {
      p_user_id: company.user_id,
    });
    if (tokenError) return new Response(JSON.stringify({ error: tokenError.message }), { status: 400 });
    const setupUrl = `${PUBLIC_APP_URL}/auth/setup?token=${encodeURIComponent(token as unknown as string)}`;
    const email = companyInviteEmail({ company_name: company.name, setup_url: setupUrl });
    result = await sendTrackedEmail(auth.supabase, {
      company_id: company.id,
      recipient_id: company.user_id,
      type: 'system',
      recipients: [retryRecipient],
      subject: email.subject,
      html: email.html,
      body: `Company portal invitation sent to current company contacts`,
      retryable: true,
      retry_of: retryRoot,
      context: { kind: 'company_invite' },
    });
  } else {
    return new Response(JSON.stringify({ error: 'Unsupported retry context' }), { status: 400 });
  }

  await auth.supabase.from('notifications').update({
    retry_count: Number(notification.retry_count || 0) + 1,
  }).eq('id', retryRoot);

  return new Response(JSON.stringify(result), {
    status: result.sent ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
};
