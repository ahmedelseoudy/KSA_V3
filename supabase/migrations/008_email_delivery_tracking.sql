-- Track asynchronous Resend delivery outcomes and controlled retries.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_status_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_status_check
  CHECK (status IN (
    'pending',
    'sent',
    'delivered',
    'delivery_delayed',
    'failed',
    'bounced',
    'suppressed',
    'complained',
    'read'
  ));

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS recipients TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_of UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_provider_message_id
  ON public.notifications(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_retry_of
  ON public.notifications(retry_of)
  WHERE retry_of IS NOT NULL;

DROP TRIGGER IF EXISTS set_notifications_updated_at ON public.notifications;
CREATE TRIGGER set_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.email_webhook_events (
  event_id TEXT PRIMARY KEY,
  provider_message_id TEXT,
  event_type TEXT NOT NULL,
  event_created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_message
  ON public.email_webhook_events(provider_message_id, event_created_at DESC);

ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view email webhook events" ON public.email_webhook_events;
CREATE POLICY "Admins can view email webhook events"
  ON public.email_webhook_events FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON public.email_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.email_webhook_events TO authenticated;
