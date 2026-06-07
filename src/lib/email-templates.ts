// HTML email templates. Keep them inline-styled and simple — most email clients
// strip <style> blocks.

const baseStyles = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; line-height: 1.5;`;
const cardStyles = `background: #ffffff; border-radius: 8px; padding: 32px; max-width: 560px; margin: 24px auto; border: 1px solid #e5e7eb;`;
const buttonStyles = `display: inline-block; background: #7c3aed; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;`;
const wrapper = (inner: string) => `
<!doctype html>
<html><body style="margin:0; padding:24px; background:#f3f4f6; ${baseStyles}">
  <div style="${cardStyles}">
    ${inner}
    <hr style="border:none; border-top:1px solid #e5e7eb; margin:32px 0 16px;" />
    <p style="font-size:12px; color:#6b7280; margin:0;">KSA CRM — Supplier Portal</p>
  </div>
</body></html>`;

export function companyInviteEmail(opts: {
  company_name: string;
  setup_url: string;
}): { subject: string; html: string } {
  return {
    subject: `Welcome to KSA CRM — set your password for ${opts.company_name}`,
    html: wrapper(`
      <h2 style="margin:0 0 16px;">You've been invited to KSA CRM</h2>
      <p>Hello ${escapeHtml(opts.company_name)} team,</p>
      <p>Your supplier account has been created. Click the button below to set your password and access your portal.</p>
      <p style="margin:24px 0;">
        <a href="${opts.setup_url}" style="${buttonStyles}">Set your password</a>
      </p>
      <p style="font-size:13px; color:#6b7280;">Or copy this link into your browser:<br/>
        <span style="word-break:break-all;">${opts.setup_url}</span>
      </p>
      <p style="font-size:13px; color:#6b7280;">This link expires in 7 days.</p>
    `),
  };
}

export function availabilityRequestEmail(opts: {
  company_name: string;
  batch_name: string;
  item_count: number;
  portal_url: string;
}): { subject: string; html: string } {
  return {
    subject: `Availability request: ${opts.batch_name}`,
    html: wrapper(`
      <h2 style="margin:0 0 16px;">New availability request</h2>
      <p>Hello ${escapeHtml(opts.company_name)} team,</p>
      <p>You have a new availability request for batch <strong>${escapeHtml(opts.batch_name)}</strong> containing <strong>${opts.item_count}</strong> items.</p>
      <p>Please log in to your portal and mark each item as available or unavailable.</p>
      <p style="margin:24px 0;">
        <a href="${opts.portal_url}" style="${buttonStyles}">Open portal</a>
      </p>
      <p style="font-size:13px; color:#6b7280;">If you have any questions, reply to this email.</p>
    `),
  };
}

export function purchaseOrderEmail(opts: {
  company_name: string;
  po_number: string;
  total_amount: string;
  item_count: number;
  portal_url: string;
}): { subject: string; html: string } {
  return {
    subject: `Purchase order ${opts.po_number}`,
    html: wrapper(`
      <h2 style="margin:0 0 16px;">New purchase order</h2>
      <p>Hello ${escapeHtml(opts.company_name)} team,</p>
      <p>A new purchase order has been issued to you.</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td style="padding:6px 0; color:#6b7280;">PO Number:</td><td style="padding:6px 0;"><strong>${escapeHtml(opts.po_number)}</strong></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Items:</td><td style="padding:6px 0;">${opts.item_count}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Total:</td><td style="padding:6px 0;">${escapeHtml(opts.total_amount)}</td></tr>
      </table>
      <p style="margin:24px 0;">
        <a href="${opts.portal_url}" style="${buttonStyles}">View &amp; confirm PO</a>
      </p>
    `),
  };
}

export function deliveryUpdateEmail(opts: {
  company_name: string;
  po_number: string;
  delivered_count: number;
  total_items: number;
  portal_url: string;
  is_complete: boolean;
}): { subject: string; html: string } {
  const subject = opts.is_complete
    ? `Delivery completed for PO ${opts.po_number}`
    : `Delivery update for PO ${opts.po_number}`;
  return {
    subject,
    html: wrapper(`
      <h2 style="margin:0 0 16px;">${opts.is_complete ? 'Delivery completed' : 'Delivery update'}</h2>
      <p>Hello ${escapeHtml(opts.company_name)} team,</p>
      <p>${opts.is_complete ? 'All items have been delivered for this purchase order.' : 'There has been an update to the delivery for this purchase order.'}</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td style="padding:6px 0; color:#6b7280;">PO Number:</td><td style="padding:6px 0;"><strong>${escapeHtml(opts.po_number)}</strong></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Delivered Items:</td><td style="padding:6px 0;">${opts.delivered_count} / ${opts.total_items}</td></tr>
      </table>
      <p style="margin:24px 0;">
        <a href="${opts.portal_url}" style="${buttonStyles}">View delivery details</a>
      </p>
    `),
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
