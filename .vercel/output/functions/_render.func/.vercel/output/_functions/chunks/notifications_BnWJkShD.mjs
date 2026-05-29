import { a as availabilityRequestEmail, s as sendEmail, p as purchaseOrderEmail, P as PUBLIC_APP_URL } from './email-templates_CPs1kHmY.mjs';

async function getCompanyContact(supabase, company_id) {
  const { data } = await supabase.from("companies").select("id, name, email, additional_emails, user_id").eq("id", company_id).single();
  return data || null;
}
function recipientList(c) {
  const list = [c.email, ...c.additional_emails || []].filter(Boolean);
  return Array.from(new Set(list.map((e) => e.toLowerCase())));
}
async function recordNotification(supabase, opts) {
  await supabase.from("notifications").insert({
    company_id: opts.company_id,
    recipient_id: opts.recipient_id,
    type: opts.type,
    subject: opts.subject,
    body: opts.sent ? opts.body : `[FAILED: ${opts.error}] ${opts.body}`,
    status: opts.sent ? "sent" : "failed",
    sent_at: opts.sent ? (/* @__PURE__ */ new Date()).toISOString() : null
  });
}
async function sendAvailabilityRequestEmail(supabase, opts) {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: "Company not found" };
  const recipients = recipientList(company);
  if (recipients.length === 0) {
    return { company_id: opts.company_id, sent: false, error: "No email addresses on file" };
  }
  const portalUrl = `${PUBLIC_APP_URL}/portal/availability?focus=${opts.availability_order_id}`;
  const { subject, html } = availabilityRequestEmail({
    company_name: company.name,
    batch_name: opts.batch_name,
    item_count: opts.item_count,
    portal_url: portalUrl
  });
  const result = await sendEmail({ to: recipients, subject, html });
  await recordNotification(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: "availability_request",
    subject,
    body: `Sent to ${recipients.join(", ")} | ${portalUrl}`,
    sent: result.ok,
    error: result.error
  });
  return { company_id: company.id, sent: result.ok, error: result.error };
}
async function sendPurchaseOrderEmail(supabase, opts) {
  const company = await getCompanyContact(supabase, opts.company_id);
  if (!company) return { company_id: opts.company_id, sent: false, error: "Company not found" };
  const recipients = recipientList(company);
  if (recipients.length === 0) {
    return { company_id: opts.company_id, sent: false, error: "No email addresses on file" };
  }
  const portalUrl = `${PUBLIC_APP_URL}/portal/purchase-orders?focus=${opts.purchase_order_id}`;
  const totalFormatted = `$${opts.total_amount.toFixed(2)}`;
  const { subject, html } = purchaseOrderEmail({
    company_name: company.name,
    po_number: opts.po_number,
    total_amount: totalFormatted,
    item_count: opts.item_count,
    portal_url: portalUrl
  });
  const result = await sendEmail({ to: recipients, subject, html });
  await recordNotification(supabase, {
    company_id: company.id,
    recipient_id: company.user_id,
    type: "po_sent",
    subject,
    body: `Sent to ${recipients.join(", ")} | ${portalUrl}`,
    sent: result.ok,
    error: result.error
  });
  return { company_id: company.id, sent: result.ok, error: result.error };
}

export { sendPurchaseOrderEmail as a, sendAvailabilityRequestEmail as s };
