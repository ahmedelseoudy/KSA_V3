import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import {
  errorForResendEvent,
  notificationIdFromTags,
  statusForResendEvent,
  verifyResendWebhook,
} from '../../../lib/resend-webhook';

export const POST: APIRoute = async ({ request }) => {
  const webhookSecret = import.meta.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret || !supabaseAdmin) {
    return new Response('Webhook not configured', { status: 503 });
  }

  const payload = await request.text();
  const messageId = request.headers.get('svix-id') || '';
  const timestamp = request.headers.get('svix-timestamp') || '';
  const signature = request.headers.get('svix-signature') || '';

  const verified = messageId && timestamp && signature
    ? await verifyResendWebhook({ payload, messageId, timestamp, signature, secret: webhookSecret })
    : false;
  if (!verified) return new Response('Invalid webhook signature', { status: 400 });

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const eventType = String(event?.type || '');
  const eventCreatedAt = String(event?.created_at || '');
  const providerMessageId = String(event?.data?.email_id || '');
  if (!eventType || !eventCreatedAt || Number.isNaN(Date.parse(eventCreatedAt))) {
    return new Response('Invalid webhook payload', { status: 400 });
  }

  const { error: eventError } = await supabaseAdmin.from('email_webhook_events').insert({
    event_id: messageId,
    provider_message_id: providerMessageId || null,
    event_type: eventType,
    event_created_at: eventCreatedAt,
    payload: event,
  });
  if (eventError && eventError.code !== '23505') {
    return new Response('Failed to persist webhook', { status: 500 });
  }

  const status = statusForResendEvent(eventType);
  if (!status) return new Response('Event recorded', { status: 200 });

  const taggedNotificationId = notificationIdFromTags(event?.data?.tags);
  let notificationQuery = supabaseAdmin
    .from('notifications')
    .select('id, last_event_at');
  notificationQuery = taggedNotificationId
    ? notificationQuery.eq('id', taggedNotificationId)
    : notificationQuery.eq('provider_message_id', providerMessageId);
  const { data: notification } = await notificationQuery.maybeSingle();

  if (notification && (!notification.last_event_at || Date.parse(eventCreatedAt) >= Date.parse(notification.last_event_at))) {
    const { error: updateError } = await supabaseAdmin.from('notifications').update({
      provider_message_id: providerMessageId || undefined,
      status,
      error_message: errorForResendEvent(event),
      last_event_at: eventCreatedAt,
    }).eq('id', notification.id);
    if (updateError) return new Response('Failed to update notification', { status: 500 });
  }

  return new Response('Webhook processed', { status: 200 });
};
