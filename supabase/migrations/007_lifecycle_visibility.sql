-- Phase 2 lifecycle visibility.
--
-- All views use security_invoker so the caller's existing table RLS remains the
-- authorization boundary. In particular, company users can see their own
-- availability/PO/company lifecycle rows, while v_batch_lifecycle remains
-- admin-only because order_batches itself is admin-only.

DROP VIEW IF EXISTS public.v_batch_lifecycle;
DROP VIEW IF EXISTS public.v_batch_company_lifecycle;
DROP VIEW IF EXISTS public.v_purchase_order_progress;
DROP VIEW IF EXISTS public.v_availability_order_progress;

CREATE VIEW public.v_availability_order_progress
WITH (security_invoker = true)
AS
WITH response_rollup AS (
  SELECT
    ar.availability_order_id,
    COUNT(*) AS requested_items,
    COUNT(*) FILTER (WHERE ar.is_available IS NOT NULL) AS answered_items,
    COUNT(*) FILTER (WHERE ar.is_available IS TRUE) AS available_items,
    COUNT(*) FILTER (WHERE ar.is_available IS FALSE) AS unavailable_items,
    COUNT(*) FILTER (WHERE ar.is_available IS NULL) AS unanswered_items,
    COALESCE(SUM(oi.order_qty), 0) AS requested_qty,
    COALESCE(SUM(
      CASE
        WHEN ar.is_available IS TRUE
          THEN COALESCE(ar.available_qty, oi.order_qty, 0)
        ELSE 0
      END
    ), 0) AS available_qty,
    MIN(ar.responded_at) FILTER (WHERE ar.is_available IS NOT NULL) AS first_response_at,
    MAX(ar.responded_at) FILTER (WHERE ar.is_available IS NOT NULL) AS last_response_at
  FROM public.availability_responses ar
  LEFT JOIN public.order_items oi ON oi.id = ar.order_item_id
  GROUP BY ar.availability_order_id
)
SELECT
  ao.id AS availability_order_id,
  ao.batch_id,
  ao.company_id,
  c.name AS company_name,
  ao.status AS availability_status,
  ao.sent_at,
  ao.responded_at,
  ao.created_at,
  COALESCE(rr.requested_items, ao.total_items::bigint, 0) AS requested_items,
  COALESCE(rr.answered_items, 0) AS answered_items,
  COALESCE(rr.available_items, 0) AS available_items,
  COALESCE(rr.unavailable_items, 0) AS unavailable_items,
  COALESCE(rr.unanswered_items, ao.total_items::bigint, 0) AS unanswered_items,
  COALESCE(rr.requested_qty, 0) AS requested_qty,
  COALESCE(rr.available_qty, 0) AS available_qty,
  rr.first_response_at,
  rr.last_response_at,
  latest.responded_by AS last_responded_by,
  latest.responded_by_role AS last_responded_by_role,
  CASE
    WHEN ao.status = 'expired' THEN 'expired'
    WHEN COALESCE(rr.answered_items, 0) = 0 THEN 'silent'
    WHEN COALESCE(rr.answered_items, 0) < COALESCE(rr.requested_items, ao.total_items::bigint, 0)
      THEN 'partial'
    ELSE 'responded'
  END AS response_stage,
  COALESCE(rr.answered_items, 0) > 0 AS has_response,
  COALESCE(rr.requested_items, ao.total_items::bigint, 0) > 0
    AND COALESCE(rr.answered_items, 0) >= COALESCE(rr.requested_items, ao.total_items::bigint, 0)
    AS response_complete,
  CASE
    WHEN COALESCE(rr.unanswered_items, ao.total_items::bigint, 0) > 0
      THEN GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (
          CURRENT_TIMESTAMP - COALESCE(rr.last_response_at, ao.sent_at, ao.created_at)
        )) / 86400)
      )::integer
    ELSE 0
  END AS days_waiting,
  GREATEST(
    ao.created_at,
    COALESCE(ao.sent_at, ao.created_at),
    COALESCE(rr.last_response_at, ao.created_at)
  ) AS last_activity_at
FROM public.availability_orders ao
LEFT JOIN public.companies c ON c.id = ao.company_id
LEFT JOIN response_rollup rr ON rr.availability_order_id = ao.id
LEFT JOIN LATERAL (
  SELECT
    ar.responded_by,
    ar.responded_by_role
  FROM public.availability_responses ar
  WHERE ar.availability_order_id = ao.id
    AND ar.is_available IS NOT NULL
  ORDER BY ar.responded_at DESC NULLS LAST, ar.created_at DESC
  LIMIT 1
) latest ON TRUE;

CREATE VIEW public.v_purchase_order_progress
WITH (security_invoker = true)
AS
WITH item_rollup AS (
  SELECT
    poi.purchase_order_id,
    COUNT(*) AS item_count,
    COALESCE(SUM(poi.quantity), 0) AS ordered_qty,
    COALESCE(SUM(poi.delivered_qty), 0) AS delivered_qty,
    COALESCE(SUM(poi.total_price), 0) AS ordered_value,
    COALESCE(SUM(
      CASE
        WHEN poi.quantity > 0
          THEN poi.total_price * LEAST(poi.delivered_qty::numeric / poi.quantity::numeric, 1)
        ELSE 0
      END
    ), 0) AS delivered_value,
    MIN(poi.delivered_at) FILTER (WHERE poi.delivered_qty > 0) AS first_delivery_at,
    MAX(poi.delivered_at) FILTER (WHERE poi.delivered_qty > 0) AS last_delivery_at
  FROM public.purchase_order_items poi
  GROUP BY poi.purchase_order_id
)
SELECT
  po.id AS purchase_order_id,
  po.batch_id,
  po.company_id,
  c.name AS company_name,
  po.availability_order_id,
  po.po_number,
  po.status AS purchase_order_status,
  po.total_amount,
  po.total_items,
  po.delivery_date,
  po.sent_at,
  po.confirmed_at,
  po.confirmed_by,
  po.confirmed_by_role,
  po.created_at,
  po.updated_at,
  COALESCE(ir.item_count, 0) AS item_count,
  COALESCE(ir.ordered_qty, 0) AS ordered_qty,
  COALESCE(ir.delivered_qty, 0) AS delivered_qty,
  COALESCE(ir.ordered_value, po.total_amount, 0) AS ordered_value,
  ROUND(COALESCE(ir.delivered_value, 0), 2) AS delivered_value,
  ir.first_delivery_at,
  ir.last_delivery_at,
  CASE
    WHEN COALESCE(ir.ordered_qty, 0) > 0
      AND COALESCE(ir.delivered_qty, 0) >= COALESCE(ir.ordered_qty, 0)
      THEN ir.last_delivery_at
    ELSE NULL
  END AS delivery_completed_at,
  CASE
    WHEN po.status = 'cancelled' THEN 'cancelled'
    WHEN COALESCE(ir.ordered_qty, 0) > 0
      AND COALESCE(ir.delivered_qty, 0) >= COALESCE(ir.ordered_qty, 0)
      THEN 'delivered'
    WHEN COALESCE(ir.delivered_qty, 0) > 0 THEN 'partially_delivered'
    WHEN po.confirmed_at IS NOT NULL OR po.status = 'confirmed' THEN 'confirmed'
    WHEN po.sent_at IS NOT NULL OR po.status = 'sent' THEN 'sent'
    ELSE 'draft'
  END AS lifecycle_stage,
  po.status <> 'cancelled'
    AND po.sent_at IS NOT NULL
    AND po.confirmed_at IS NULL
    AS awaiting_confirmation,
  po.status <> 'cancelled'
    AND po.confirmed_at IS NOT NULL
    AND COALESCE(ir.delivered_qty, 0) = 0
    AS ready_to_schedule,
  po.status <> 'cancelled'
    AND po.delivery_date IS NOT NULL
    AND po.delivery_date < CURRENT_DATE
    AND (
      COALESCE(ir.ordered_qty, 0) = 0
      OR COALESCE(ir.delivered_qty, 0) < COALESCE(ir.ordered_qty, 0)
    )
    AS is_overdue,
  GREATEST(
    po.created_at,
    po.updated_at,
    COALESCE(po.sent_at, po.created_at),
    COALESCE(po.confirmed_at, po.created_at),
    COALESCE(ir.last_delivery_at, po.created_at)
  ) AS last_activity_at
FROM public.purchase_orders po
LEFT JOIN public.companies c ON c.id = po.company_id
LEFT JOIN item_rollup ir ON ir.purchase_order_id = po.id;

CREATE VIEW public.v_batch_company_lifecycle
WITH (security_invoker = true)
AS
WITH ranked_availability AS (
  SELECT
    progress.*,
    ROW_NUMBER() OVER (
      PARTITION BY progress.batch_id, progress.company_id
      ORDER BY progress.created_at DESC, progress.availability_order_id DESC
    ) AS row_rank
  FROM public.v_availability_order_progress progress
),
current_availability AS (
  SELECT * FROM ranked_availability WHERE row_rank = 1
),
ranked_purchase_orders AS (
  SELECT
    progress.*,
    ROW_NUMBER() OVER (
      PARTITION BY progress.batch_id, progress.company_id
      ORDER BY
        (progress.purchase_order_status <> 'cancelled') DESC,
        progress.created_at DESC,
        progress.purchase_order_id DESC
    ) AS row_rank
  FROM public.v_purchase_order_progress progress
),
current_purchase_orders AS (
  SELECT * FROM ranked_purchase_orders WHERE row_rank = 1
)
SELECT
  COALESCE(a.batch_id, p.batch_id) AS batch_id,
  COALESCE(a.company_id, p.company_id) AS company_id,
  COALESCE(a.company_name, p.company_name) AS company_name,
  a.availability_order_id,
  a.availability_status,
  a.response_stage,
  a.sent_at AS availability_sent_at,
  a.first_response_at,
  a.last_response_at,
  a.last_responded_by,
  a.last_responded_by_role,
  COALESCE(a.requested_items, 0) AS requested_items,
  COALESCE(a.answered_items, 0) AS answered_items,
  COALESCE(a.available_items, 0) AS available_items,
  COALESCE(a.unavailable_items, 0) AS unavailable_items,
  COALESCE(a.unanswered_items, 0) AS unanswered_items,
  COALESCE(a.requested_qty, 0) AS requested_qty,
  COALESCE(a.available_qty, 0) AS available_qty,
  COALESCE(a.days_waiting, 0) AS response_days_waiting,
  p.purchase_order_id,
  p.purchase_order_status,
  p.po_number,
  p.delivery_date,
  p.sent_at AS purchase_order_sent_at,
  p.confirmed_at,
  p.confirmed_by,
  p.confirmed_by_role,
  p.first_delivery_at,
  p.last_delivery_at,
  p.delivery_completed_at,
  COALESCE(p.ordered_qty, 0) AS ordered_qty,
  COALESCE(p.delivered_qty, 0) AS delivered_qty,
  COALESCE(p.ordered_value, 0) AS ordered_value,
  COALESCE(p.delivered_value, 0) AS delivered_value,
  COALESCE(p.awaiting_confirmation, FALSE) AS awaiting_confirmation,
  COALESCE(p.ready_to_schedule, FALSE) AS ready_to_schedule,
  COALESCE(p.is_overdue, FALSE) AS is_overdue,
  CASE
    WHEN p.purchase_order_status = 'cancelled' THEN 'cancelled'
    WHEN p.lifecycle_stage = 'delivered' THEN 'delivered'
    WHEN p.lifecycle_stage = 'partially_delivered' THEN 'partially_delivered'
    WHEN p.awaiting_confirmation THEN 'awaiting_confirmation'
    WHEN p.lifecycle_stage = 'confirmed' THEN 'ready_to_schedule'
    WHEN p.purchase_order_id IS NOT NULL THEN p.lifecycle_stage
    WHEN a.response_stage = 'responded' AND COALESCE(a.available_items, 0) > 0 THEN 'ready_for_po'
    WHEN a.response_stage = 'responded' THEN 'nothing_to_order'
    WHEN a.response_stage = 'partial' THEN 'partial_response'
    WHEN a.response_stage = 'expired' THEN 'expired'
    ELSE 'awaiting_response'
  END AS lifecycle_stage,
  CASE
    WHEN p.purchase_order_status = 'cancelled' THEN 0
    WHEN p.lifecycle_stage = 'delivered' THEN 6
    WHEN p.lifecycle_stage = 'partially_delivered' THEN 5
    WHEN p.awaiting_confirmation THEN 3
    WHEN p.lifecycle_stage = 'confirmed' THEN 4
    WHEN p.purchase_order_id IS NOT NULL THEN 3
    WHEN a.response_stage = 'responded' THEN 2
    WHEN a.response_stage = 'partial' THEN 2
    ELSE 1
  END AS stage_index,
  CASE
    WHEN p.purchase_order_status = 'cancelled' THEN 'No action — purchase order cancelled'
    WHEN p.lifecycle_stage = 'delivered' THEN 'No action — delivery complete'
    WHEN p.lifecycle_stage = 'partially_delivered' THEN 'Record the remaining delivery'
    WHEN p.awaiting_confirmation THEN 'Request purchase-order confirmation'
    WHEN p.lifecycle_stage = 'confirmed' THEN 'Schedule or record delivery'
    WHEN p.purchase_order_id IS NOT NULL THEN 'Send the purchase order'
    WHEN a.response_stage = 'responded' AND COALESCE(a.available_items, 0) > 0 THEN 'Generate purchase order'
    WHEN a.response_stage = 'responded' THEN 'No orderable items'
    WHEN a.response_stage = 'partial' THEN 'Complete response or include partial response'
    WHEN a.response_stage = 'expired' THEN 'Review expired availability request'
    ELSE 'Request availability response'
  END AS next_action,
  GREATEST(
    COALESCE(a.last_activity_at, '-infinity'::timestamptz),
    COALESCE(p.last_activity_at, '-infinity'::timestamptz)
  ) AS last_activity_at
FROM current_availability a
FULL OUTER JOIN current_purchase_orders p
  ON p.batch_id = a.batch_id
 AND p.company_id = a.company_id;

CREATE VIEW public.v_batch_lifecycle
WITH (security_invoker = true)
AS
WITH lifecycle_rollup AS (
  SELECT
    lifecycle.batch_id,
    COUNT(*) AS companies_count,
    COUNT(*) FILTER (WHERE lifecycle.response_stage = 'responded') AS responded_companies,
    COUNT(*) FILTER (WHERE lifecycle.response_stage = 'partial') AS partial_companies,
    COUNT(*) FILTER (WHERE lifecycle.response_stage IN ('silent', 'expired') OR lifecycle.response_stage IS NULL) AS silent_companies,
    COUNT(*) FILTER (WHERE lifecycle.purchase_order_id IS NOT NULL AND lifecycle.purchase_order_status <> 'cancelled') AS purchase_order_count,
    COUNT(*) FILTER (WHERE lifecycle.awaiting_confirmation) AS awaiting_confirmation_count,
    COUNT(*) FILTER (WHERE lifecycle.ready_to_schedule) AS ready_to_schedule_count,
    COUNT(*) FILTER (WHERE lifecycle.is_overdue) AS overdue_count,
    COUNT(*) FILTER (WHERE lifecycle.lifecycle_stage = 'partially_delivered') AS partially_delivered_count,
    COUNT(*) FILTER (WHERE lifecycle.lifecycle_stage = 'delivered') AS delivered_count,
    COALESCE(SUM(lifecycle.requested_qty), 0) AS requested_qty,
    COALESCE(SUM(lifecycle.available_qty), 0) AS available_qty,
    COALESCE(SUM(lifecycle.ordered_qty), 0) AS ordered_qty,
    COALESCE(SUM(lifecycle.delivered_qty), 0) AS delivered_qty,
    COALESCE(SUM(lifecycle.ordered_value), 0) AS ordered_value,
    COALESCE(SUM(lifecycle.delivered_value), 0) AS delivered_value,
    MIN(lifecycle.availability_sent_at) AS availability_sent_at,
    MIN(lifecycle.first_response_at) AS first_response_at,
    MAX(lifecycle.last_response_at) AS last_response_at,
    MIN(lifecycle.purchase_order_sent_at) AS first_purchase_order_sent_at,
    MAX(lifecycle.purchase_order_sent_at) AS last_purchase_order_sent_at,
    MIN(lifecycle.first_delivery_at) AS first_delivery_at,
    MAX(lifecycle.delivery_completed_at) AS last_delivery_completed_at,
    MAX(lifecycle.last_activity_at) AS child_last_activity_at
  FROM public.v_batch_company_lifecycle lifecycle
  GROUP BY lifecycle.batch_id
),
batch_progress AS (
  SELECT
    b.*,
    COALESCE(r.companies_count, 0) AS companies_count,
    COALESCE(r.responded_companies, 0) AS responded_companies,
    COALESCE(r.partial_companies, 0) AS partial_companies,
    COALESCE(r.silent_companies, 0) AS silent_companies,
    COALESCE(r.purchase_order_count, 0) AS purchase_order_count,
    COALESCE(r.awaiting_confirmation_count, 0) AS awaiting_confirmation_count,
    COALESCE(r.ready_to_schedule_count, 0) AS ready_to_schedule_count,
    COALESCE(r.overdue_count, 0) AS overdue_count,
    COALESCE(r.partially_delivered_count, 0) AS partially_delivered_count,
    COALESCE(r.delivered_count, 0) AS delivered_count,
    COALESCE(r.requested_qty, 0) AS requested_qty,
    COALESCE(r.available_qty, 0) AS available_qty,
    COALESCE(r.ordered_qty, 0) AS ordered_qty,
    COALESCE(r.delivered_qty, 0) AS delivered_qty,
    COALESCE(r.ordered_value, 0) AS ordered_value,
    COALESCE(r.delivered_value, 0) AS delivered_value,
    r.availability_sent_at,
    r.first_response_at,
    r.last_response_at,
    CASE
      WHEN COALESCE(r.companies_count, 0) > 0
        AND COALESCE(r.responded_companies, 0) = COALESCE(r.companies_count, 0)
        THEN r.last_response_at
      ELSE NULL
    END AS responses_completed_at,
    r.first_purchase_order_sent_at,
    r.last_purchase_order_sent_at,
    r.first_delivery_at,
    CASE
      WHEN COALESCE(r.purchase_order_count, 0) > 0
        AND COALESCE(r.delivered_count, 0) = COALESCE(r.purchase_order_count, 0)
        THEN r.last_delivery_completed_at
      ELSE NULL
    END AS delivery_completed_at,
    GREATEST(
      b.created_at,
      b.updated_at,
      COALESCE(r.child_last_activity_at, b.created_at)
    ) AS last_activity_at
  FROM public.order_batches b
  LEFT JOIN lifecycle_rollup r ON r.batch_id = b.id
)
SELECT
  progress.*,
  CASE
    WHEN progress.status = 'cancelled' THEN 'cancelled'
    WHEN progress.purchase_order_count > 0
      AND progress.delivered_count = progress.purchase_order_count
      THEN 'completed'
    WHEN progress.partially_delivered_count > 0 OR progress.delivered_qty > 0
      THEN 'partially_delivered'
    WHEN progress.purchase_order_count > 0 THEN 'po_sent'
    WHEN progress.responded_companies > 0 OR progress.partial_companies > 0
      THEN 'responses_ready'
    WHEN progress.companies_count > 0 THEN 'availability_sent'
    ELSE 'created'
  END AS lifecycle_stage,
  CASE
    WHEN progress.status = 'cancelled' THEN 0
    WHEN progress.purchase_order_count > 0
      AND progress.delivered_count = progress.purchase_order_count
      THEN 5
    WHEN progress.partially_delivered_count > 0 OR progress.delivered_qty > 0
      THEN 4
    WHEN progress.purchase_order_count > 0 THEN 3
    WHEN progress.responded_companies > 0 OR progress.partial_companies > 0
      THEN 2
    WHEN progress.companies_count > 0 THEN 1
    ELSE 0
  END AS stage_index,
  CASE
    WHEN progress.status = 'cancelled' THEN 'No action — batch cancelled'
    WHEN progress.overdue_count > 0
      THEN 'Follow up on overdue deliveries'
    WHEN progress.awaiting_confirmation_count > 0
      THEN 'Request purchase-order confirmations'
    WHEN progress.ready_to_schedule_count > 0
      THEN 'Schedule or record delivery'
    WHEN progress.purchase_order_count > 0
      AND progress.delivered_count = progress.purchase_order_count
      THEN 'No action — batch complete'
    WHEN progress.partially_delivered_count > 0 OR progress.delivered_qty > 0
      THEN 'Record remaining deliveries'
    WHEN progress.responded_companies > 0 OR progress.partial_companies > 0
      THEN 'Generate eligible purchase orders'
    WHEN progress.companies_count > 0
      THEN 'Collect availability responses'
    ELSE 'Send availability requests'
  END AS next_action
FROM batch_progress progress;

GRANT SELECT ON
  public.v_availability_order_progress,
  public.v_purchase_order_progress,
  public.v_batch_company_lifecycle,
  public.v_batch_lifecycle
TO authenticated, service_role;

REVOKE ALL ON
  public.v_availability_order_progress,
  public.v_purchase_order_progress,
  public.v_batch_company_lifecycle,
  public.v_batch_lifecycle
FROM anon;

COMMENT ON VIEW public.v_availability_order_progress IS
  'One RLS-scoped row per supplier availability request, derived from raw response rows.';
COMMENT ON VIEW public.v_purchase_order_progress IS
  'One RLS-scoped row per purchase order with quantity, value, confirmation, and delivery progress.';
COMMENT ON VIEW public.v_batch_company_lifecycle IS
  'One RLS-scoped current lifecycle row per batch and company, including companies that have no PO.';
COMMENT ON VIEW public.v_batch_lifecycle IS
  'One admin-scoped lifecycle summary per order batch; order_batches RLS intentionally hides it from company users.';

NOTIFY pgrst, 'reload schema';
