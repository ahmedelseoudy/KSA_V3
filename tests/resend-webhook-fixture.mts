import assert from 'node:assert/strict';
import {
  errorForResendEvent,
  notificationIdFromTags,
  statusForResendEvent,
  verifyResendWebhook,
} from '../src/lib/resend-webhook.ts';

const nowSeconds = 1_800_000_000;
const messageId = 'msg_webhook_fixture';
const timestamp = String(nowSeconds);
const payload = JSON.stringify({
  type: 'email.bounced',
  created_at: '2027-01-15T08:00:00.000Z',
  data: {
    email_id: 'email_fixture',
    to: ['failed@example.com'],
    tags: { notification_id: '11111111-1111-4111-8111-111111111111' },
    bounce: { type: 'Permanent', subType: 'General', message: 'Mailbox does not exist' },
  },
});
const secretBytes = crypto.getRandomValues(new Uint8Array(32));
const secret = `whsec_${Buffer.from(secretBytes).toString('base64')}`;
const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const signedContent = `${messageId}.${timestamp}.${payload}`;
const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
const signature = `v1,${Buffer.from(signatureBytes).toString('base64')}`;

assert.equal(await verifyResendWebhook({ payload, messageId, timestamp, signature, secret, nowSeconds }), true);
assert.equal(await verifyResendWebhook({ payload, messageId, timestamp, signature, secret: secret.replace(/=+$/, ''), nowSeconds }), true);
assert.equal(await verifyResendWebhook({ payload: `${payload} `, messageId, timestamp, signature, secret, nowSeconds }), false);
assert.equal(await verifyResendWebhook({ payload, messageId, timestamp, signature, secret, nowSeconds: nowSeconds + 301 }), false);
assert.equal(statusForResendEvent('email.delivered'), 'delivered');
assert.equal(statusForResendEvent('email.bounced'), 'bounced');
assert.equal(statusForResendEvent('email.opened'), null);
assert.equal(notificationIdFromTags({ notification_id: 'tracked-id' }), 'tracked-id');
assert.equal(notificationIdFromTags([{ name: 'notification_id', value: 'array-id' }]), 'array-id');
assert.equal(errorForResendEvent(JSON.parse(payload)), 'failed@example.com: Mailbox does not exist');

console.log('Resend webhook fixture passed');
