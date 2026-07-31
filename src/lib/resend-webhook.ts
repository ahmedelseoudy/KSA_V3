const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function verifyResendWebhook(input: {
  payload: string;
  messageId: string;
  timestamp: string;
  signature: string;
  secret: string;
  nowSeconds?: number;
}): Promise<boolean> {
  const timestampNumber = Number(input.timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > MAX_WEBHOOK_AGE_SECONDS) {
    return false;
  }

  const secretValue = input.secret.startsWith('whsec_') ? input.secret.slice(6) : input.secret;
  let secretBytes: Uint8Array;
  try {
    secretBytes = decodeBase64(secretValue);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedContent = `${input.messageId}.${input.timestamp}.${input.payload}`;
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  );

  return input.signature.split(' ').some((candidate) => {
    const [version, encoded] = candidate.split(',', 2);
    if (version !== 'v1' || !encoded) return false;
    try {
      return constantTimeEqual(expected, decodeBase64(encoded));
    } catch {
      return false;
    }
  });
}

export type TrackedEmailStatus =
  | 'sent'
  | 'delivered'
  | 'delivery_delayed'
  | 'failed'
  | 'bounced'
  | 'suppressed'
  | 'complained';

export function statusForResendEvent(eventType: string): TrackedEmailStatus | null {
  const statuses: Record<string, TrackedEmailStatus> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'delivery_delayed',
    'email.failed': 'failed',
    'email.bounced': 'bounced',
    'email.suppressed': 'suppressed',
    'email.complained': 'complained',
  };
  return statuses[eventType] || null;
}

export function errorForResendEvent(event: any): string | null {
  const detail = event?.data?.bounce || event?.data?.failed || event?.data?.suppressed;
  const impactedRecipient = Array.isArray(event?.data?.to) ? event.data.to[0] : null;
  const prefix = impactedRecipient ? `${impactedRecipient}: ` : '';
  if (typeof detail === 'string') return `${prefix}${detail}`;
  if (detail?.message) return `${prefix}${String(detail.message)}`;
  if (detail?.reason) return `${prefix}${String(detail.reason)}`;
  if (['email.bounced', 'email.failed', 'email.suppressed', 'email.complained'].includes(event?.type)) {
    return `${prefix}Resend reported ${String(event.type).replace('email.', '')}`;
  }
  return null;
}

export function notificationIdFromTags(tags: unknown): string | null {
  if (tags && !Array.isArray(tags) && typeof tags === 'object') {
    const value = (tags as Record<string, unknown>).notification_id;
    return typeof value === 'string' ? value : null;
  }
  if (Array.isArray(tags)) {
    const tag = tags.find((entry) => entry?.name === 'notification_id');
    return typeof tag?.value === 'string' ? tag.value : null;
  }
  return null;
}
