import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

function loadEnv() {
  const values = {};
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const env = loadEnv();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4330';
const restUrl = `${env.PUBLIC_SUPABASE_URL}/rest/v1`;
const serviceHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};
const providerMessageId = `fixture-${crypto.randomUUID()}`;
let notificationId = '';
let eventId = '';

try {
  // Recover any row left by an interrupted earlier fixture run.
  await fetch(`${restUrl}/notifications?subject=eq.${encodeURIComponent('Disposable webhook fixture')}`, {
    method: 'DELETE',
    headers: serviceHeaders,
  });
  const insertResponse = await fetch(`${restUrl}/notifications`, {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({
      type: 'system',
      subject: 'Disposable webhook fixture',
      body: 'Deleted after validation',
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: providerMessageId,
      recipients: ['fixture@example.com'],
      retryable: false,
      context: { kind: 'fixture' },
    }),
  });
  if (insertResponse.status !== 201) {
    throw new Error(`Notification fixture insert failed: ${insertResponse.status} ${await insertResponse.text()}`);
  }
  const inserted = await insertResponse.json();
  notificationId = inserted[0].id;

  eventId = `msg_${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({
    type: 'email.bounced',
    created_at: new Date().toISOString(),
    data: {
      email_id: providerMessageId,
      to: ['fixture@example.com'],
      tags: { notification_id: notificationId },
      bounce: { type: 'Permanent', subType: 'General', message: 'Fixture hard bounce' },
    },
  });
  const secret = Buffer.from(env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${eventId}.${timestamp}.${payload}`)
    .digest('base64');
  const webhookHeaders = {
    'Content-Type': 'application/json',
    'svix-id': eventId,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  };

  const webhookResponse = await fetch(`${baseUrl}/api/webhooks/resend`, {
    method: 'POST',
    headers: webhookHeaders,
    body: payload,
  });
  if (webhookResponse.status !== 200) {
    throw new Error(`Webhook request failed: ${webhookResponse.status} ${await webhookResponse.text()}`);
  }

  const replayResponse = await fetch(`${baseUrl}/api/webhooks/resend`, {
    method: 'POST',
    headers: webhookHeaders,
    body: payload,
  });
  if (replayResponse.status !== 200) {
    throw new Error(`Webhook replay failed: ${replayResponse.status} ${await replayResponse.text()}`);
  }

  const invalidResponse = await fetch(`${baseUrl}/api/webhooks/resend`, {
    method: 'POST',
    headers: webhookHeaders,
    body: `${payload} `,
  });
  assert.equal(invalidResponse.status, 400);

  const notificationResponse = await fetch(
    `${restUrl}/notifications?id=eq.${notificationId}&select=status,error_message,last_event_at`,
    { headers: serviceHeaders }
  );
  if (notificationResponse.status !== 200) {
    throw new Error(`Notification read failed: ${notificationResponse.status} ${await notificationResponse.text()}`);
  }
  const [notification] = await notificationResponse.json();
  assert.equal(notification.status, 'bounced');
  assert.match(notification.error_message, /fixture@example\.com: Fixture hard bounce/);
  assert.ok(notification.last_event_at);

  const eventResponse = await fetch(
    `${restUrl}/email_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id`,
    { headers: serviceHeaders }
  );
  const events = await eventResponse.json();
  assert.equal(events.length, 1);
  console.log('Email webhook endpoint fixture passed');
} finally {
  if (eventId) {
    await fetch(`${restUrl}/email_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });
  }
  if (notificationId) {
    await fetch(`${restUrl}/notifications?id=eq.${notificationId}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });
  }
}
