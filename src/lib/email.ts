// Lightweight Resend wrapper. Server-side only.

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = import.meta.env.RESEND_FROM_EMAIL || 'KSA CRM <onboarding@resend.dev>';
export const PUBLIC_APP_URL = import.meta.env.PUBLIC_APP_URL || 'http://localhost:4321';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  if (recipients.length === 0) {
    return { ok: false, error: 'No recipients' };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: recipients,
        subject: input.subject,
        html: input.html,
        reply_to: input.reply_to,
      }),
    });

    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: json?.message || `Resend error ${resp.status}` };
    }
    return { ok: true, id: json?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}
