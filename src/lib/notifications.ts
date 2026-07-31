// Transactional notification helpers with Resend delivery tracking.

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, PUBLIC_APP_URL } from './email';
import { availabilityRequestEmail, purchaseOrderEmail, deliveryUpdateEmail } from './email-templates';
import { formatCurrency } from '../utils/currency';
import { supabaseAdmin } from './supabase';

export type NotificationType =
  | 'availability_request'
  | 'po_sent'
  | 'delivery_reminder'
  | 'order_completed'
  | 'system';

interface CompanyContact {
  id: string;
  name: string;
  email: string | null;
  additional_emails: string[] | null;
  user_id: string | null;
}

async function getCompanyContact(
  supabase: SupabaseClient,
  company_id: string
): Promise<CompanyContact | null> {
  const { data } = await supabase
    .from('companies')
    .select('id, name, email, additional_emails, user_id')
    .eq('id', company_id)
    .single();
  return (data as CompanyContact) || null;
}

function recipientList(company: CompanyContact): string[] {
  const list = [company.email, ...(company.additional_emails || [])].filter(Boolean) as string[];
  return Array.from(new Set(list.map((email) => email.trim().toLowerCase()).filter(Boolean)));
}

export interface DispatchResult {
  company_id: string;
  sent: boolean;
  error?: string;
  notification_id?: string;
  provider_message_id?: string;
}

export async function sendTrackedEmail(
  supabase: SupabaseClient,
  opts: {
    company_id?: string | null;
    recipient_id?: string | null;
    type: NotificationType;
    recipients: string[];
    subject: string;
    body: string;
    html: string;
    context?: Record<string, unknown>;
    retryable?: boolean;
    retry_of?: string | null;
  }
): Promise<DispatchResult> {
  const recipients = Array.from(
    new Set(opts.recipients.map((email) => email.trim().toLowerCase()).filter(Boolean))
  );
  if (recipients.length === 0) {
    return { company_id: opts.company_id || '', sent: false, error: 'No email addresses on file' };
  }

  const trackingClient = supabaseAdmin || supabase;
  const results: Array<{ notificationId?: string; providerMessageId?: string; error?: string }> = [];
  for (const recipient of recipients) {
    const { data: notification, error: insertError } = await trackingClient
      .from('notifications')
      .insert({
        company_id: opts.company_id || null,
        recipient_id: opts.recipient_id || null,
        type: opts.type,
        subject: opts.subject,
        body: opts.body,
        status: 'pending',
        recipients: [recipient],
        context: opts.context || {},
        retryable: opts.retryable === true,
        retry_of: opts.retry_of || null,
      })
      .select('id')
      .single();

    if (insertError || !notification) {
      results.push({ error: insertError?.message || 'Failed to create notification tracking row' });
      continue;
    }

    const result = await sendEmail({
      to: recipient,
      subject: opts.subject,
      html: opts.html,
      idempotency_key: `notification/${notification.id}`,
      tags: [{ name: 'notification_id', value: notification.id }],
    });

    // A fast webhook can move the row beyond pending before the API call returns.
    // Never overwrite that asynchronous outcome with the earlier "sent" state.
    await trackingClient.from('notifications').update({
      provider_message_id: result.id || null,
      status: result.ok ? 'sent' : 'failed',
      sent_at: result.ok ? new Date().toISOString() : null,
      error_message: result.ok ? null : result.error || 'Email provider rejected the request',
      last_event_at: new Date().toISOString(),
    }).eq('id', notification.id).eq('status', 'pending');

    results.push({
      notificationId: notification.id,
      providerMessageId: result.id,
      error: result.ok ? undefined : result.error,
    });
  }

  const errors = results.map((result) => result.error).filter(Boolean) as string[];
  const firstTracked = results.find((result) => result.notificationId);

  return {
    company_id: opts.company_id || '',
    sent: results.length === recipients.length && errors.length === 0,
    error: errors.length ? Array.from(new Set(errors)).join('; ') : undefined,
    notification_id: firstTracked?.notificationId,
    provider_message_id: firstTracked?.providerMessageId,
  };
}

export async function sendAvailabilityRequestEmail(
  supabase: SupabaseClient,
  opts: {
    company_id: string;
    availability_order_id: string;
    batch_name: string;
    item_count: number;
    retry_of?: string | null;
    recipients_override?: string[];
  }
): Promise<DispatchResult> {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: 'Company not found' };

  const recipients = opts.recipients_override || recipientList(company);
  const portalUrl = `${PUBLIC_APP_URL}/portal/availability?focus=${opts.availability_order_id}`;
  const { subject, html } = availabilityRequestEmail({
    company_name: company.name,
    batch_name: opts.batch_name,
    item_count: opts.item_count,
    portal_url: portalUrl,
  });

  return sendTrackedEmail(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: 'availability_request',
    recipients,
    subject,
    body: `Sent to ${recipients.join(', ')} | ${portalUrl}`,
    html,
    retryable: true,
    retry_of: opts.retry_of,
    context: {
      kind: 'availability_request',
      availability_order_id: opts.availability_order_id,
      batch_name: opts.batch_name,
      item_count: opts.item_count,
    },
  });
}

export async function sendDeliveryConfirmationEmail(
  supabase: SupabaseClient,
  opts: {
    company_id: string;
    purchase_order_id: string;
    po_number: string;
    delivered_count: number;
    total_items: number;
    is_complete: boolean;
    retry_of?: string | null;
    recipients_override?: string[];
  }
): Promise<DispatchResult> {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: 'Company not found' };

  const recipients = opts.recipients_override || recipientList(company);
  const portalUrl = `${PUBLIC_APP_URL}/portal/purchase-orders?focus=${opts.purchase_order_id}`;
  const { subject, html } = deliveryUpdateEmail({
    company_name: company.name,
    po_number: opts.po_number,
    delivered_count: opts.delivered_count,
    total_items: opts.total_items,
    portal_url: portalUrl,
    is_complete: opts.is_complete,
  });

  return sendTrackedEmail(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: opts.is_complete ? 'order_completed' : 'delivery_reminder',
    recipients,
    subject,
    body: `Sent to ${recipients.join(', ')} | ${portalUrl}`,
    html,
    retryable: true,
    retry_of: opts.retry_of,
    context: {
      kind: 'delivery_update',
      purchase_order_id: opts.purchase_order_id,
      po_number: opts.po_number,
      delivered_count: opts.delivered_count,
      total_items: opts.total_items,
      is_complete: opts.is_complete,
    },
  });
}

export async function sendPurchaseOrderEmail(
  supabase: SupabaseClient,
  opts: {
    company_id: string;
    purchase_order_id: string;
    po_number: string;
    item_count: number;
    total_amount: number;
    retry_of?: string | null;
    recipients_override?: string[];
  }
): Promise<DispatchResult> {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: 'Company not found' };

  const recipients = opts.recipients_override || recipientList(company);
  const portalUrl = `${PUBLIC_APP_URL}/portal/purchase-orders?focus=${opts.purchase_order_id}`;
  const { subject, html } = purchaseOrderEmail({
    company_name: company.name,
    po_number: opts.po_number,
    total_amount: formatCurrency(opts.total_amount),
    item_count: opts.item_count,
    portal_url: portalUrl,
  });

  return sendTrackedEmail(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: 'po_sent',
    recipients,
    subject,
    body: `Sent to ${recipients.join(', ')} | ${portalUrl}`,
    html,
    retryable: true,
    retry_of: opts.retry_of,
    context: {
      kind: 'purchase_order',
      purchase_order_id: opts.purchase_order_id,
      po_number: opts.po_number,
      item_count: opts.item_count,
      total_amount: opts.total_amount,
    },
  });
}
