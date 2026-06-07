// Notification dispatch helpers. Used by availability + PO endpoints.
// Each helper:
//   1. Looks up company emails (primary + additional_emails)
//   2. Renders the template
//   3. Sends via Resend
//   4. Inserts a notifications row with the resulting status

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, PUBLIC_APP_URL } from './email';
import { availabilityRequestEmail, purchaseOrderEmail, deliveryUpdateEmail } from './email-templates';

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

function recipientList(c: CompanyContact): string[] {
  const list = [c.email, ...(c.additional_emails || [])].filter(Boolean) as string[];
  return Array.from(new Set(list.map((e) => e.toLowerCase())));
}

async function recordNotification(
  supabase: SupabaseClient,
  opts: {
    company_id: string;
    recipient_id: string | null;
    type: 'availability_request' | 'po_sent' | 'delivery_reminder' | 'order_completed';
    subject: string;
    body: string;
    sent: boolean;
    error?: string;
  }
) {
  await supabase.from('notifications').insert({
    company_id: opts.company_id,
    recipient_id: opts.recipient_id,
    type: opts.type,
    subject: opts.subject,
    body: opts.sent ? opts.body : `[FAILED: ${opts.error}] ${opts.body}`,
    status: opts.sent ? 'sent' : 'failed',
    sent_at: opts.sent ? new Date().toISOString() : null,
  });
}

export interface DispatchResult {
  company_id: string;
  sent: boolean;
  error?: string;
}

export async function sendAvailabilityRequestEmail(
  supabase: SupabaseClient,
  opts: {
    company_id: string;
    availability_order_id: string;
    batch_name: string;
    item_count: number;
  }
): Promise<DispatchResult> {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: 'Company not found' };

  const recipients = recipientList(company);
  if (recipients.length === 0) {
    return { company_id: opts.company_id, sent: false, error: 'No email addresses on file' };
  }

  const portalUrl = `${PUBLIC_APP_URL}/portal/availability?focus=${opts.availability_order_id}`;
  const { subject, html } = availabilityRequestEmail({
    company_name: company.name,
    batch_name: opts.batch_name,
    item_count: opts.item_count,
    portal_url: portalUrl,
  });

  const result = await sendEmail({ to: recipients, subject, html });
  await recordNotification(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: 'availability_request',
    subject,
    body: `Sent to ${recipients.join(', ')} | ${portalUrl}`,
    sent: result.ok,
    error: result.error,
  });

  return { company_id: company.id, sent: result.ok, error: result.error };
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
  }
): Promise<DispatchResult> {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: 'Company not found' };

  const recipients = recipientList(company);
  if (recipients.length === 0) {
    return { company_id: opts.company_id, sent: false, error: 'No email addresses on file' };
  }

  const portalUrl = `${PUBLIC_APP_URL}/portal/purchase-orders?focus=${opts.purchase_order_id}`;
  const { subject, html } = deliveryUpdateEmail({
    company_name: company.name,
    po_number: opts.po_number,
    delivered_count: opts.delivered_count,
    total_items: opts.total_items,
    portal_url: portalUrl,
    is_complete: opts.is_complete,
  });

  const result = await sendEmail({ to: recipients, subject, html });
  await recordNotification(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: opts.is_complete ? 'order_completed' : 'delivery_reminder',
    subject,
    body: `Sent to ${recipients.join(', ')} | ${portalUrl}`,
    sent: result.ok,
    error: result.error,
  });

  return { company_id: company.id, sent: result.ok, error: result.error };
}

export async function sendPurchaseOrderEmail(
  supabase: SupabaseClient,
  opts: {
    company_id: string;
    purchase_order_id: string;
    po_number: string;
    item_count: number;
    total_amount: number;
  }
): Promise<DispatchResult> {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: 'Company not found' };

  const recipients = recipientList(company);
  if (recipients.length === 0) {
    return { company_id: opts.company_id, sent: false, error: 'No email addresses on file' };
  }

  const portalUrl = `${PUBLIC_APP_URL}/portal/purchase-orders?focus=${opts.purchase_order_id}`;
  const totalFormatted = `$${opts.total_amount.toFixed(2)}`;
  const { subject, html } = purchaseOrderEmail({
    company_name: company.name,
    po_number: opts.po_number,
    total_amount: totalFormatted,
    item_count: opts.item_count,
    portal_url: portalUrl,
  });

  const result = await sendEmail({ to: recipients, subject, html });
  await recordNotification(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: 'po_sent',
    subject,
    body: `Sent to ${recipients.join(', ')} | ${portalUrl}`,
    sent: result.ok,
    error: result.error,
  });

  return { company_id: company.id, sent: result.ok, error: result.error };
}
