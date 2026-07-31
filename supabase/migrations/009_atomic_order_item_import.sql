-- Atomic, idempotent order-item imports.
-- Re-uploading a draft batch replaces its items in one transaction. The
-- advisory lock serializes duplicate/concurrent submissions for the same batch.

CREATE OR REPLACE FUNCTION public.replace_order_batch_items(
  p_batch_id UUID,
  p_items JSONB
)
RETURNS TABLE(saved INTEGER, replaced INTEGER, total_value NUMERIC)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_batch_status TEXT;
  v_saved INTEGER := 0;
  v_replaced INTEGER := 0;
  v_total_value NUMERIC := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 10000 THEN
    RAISE EXCEPTION 'items must contain between 1 and 10000 rows' USING ERRCODE = '22023';
  END IF;

  -- A transaction-scoped lock prevents two browser submissions from appending
  -- or interleaving rows for the same batch.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_batch_id::TEXT, 0));

  SELECT status
    INTO v_batch_status
    FROM public.order_batches
   WHERE id = p_batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order batch not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_batch_status <> 'draft' THEN
    RAISE EXCEPTION 'Order items can only be replaced while the batch is in draft status'
      USING ERRCODE = '55000';
  END IF;

  SELECT count(*)::INTEGER
    INTO v_replaced
    FROM public.order_items
   WHERE batch_id = p_batch_id;

  DELETE FROM public.order_items WHERE batch_id = p_batch_id;

  WITH inserted AS (
    INSERT INTO public.order_items (
      batch_id,
      product_id,
      barcode,
      asin,
      title,
      company_id,
      order_qty,
      boxes,
      amazon_cost,
      amazon_cost_after_rebate,
      provider_cost,
      profit_loss,
      profit_loss_pct,
      match_status
    )
    SELECT
      p_batch_id,
      item.product_id,
      item.barcode,
      item.asin,
      item.title,
      item.company_id,
      item.order_qty,
      item.boxes,
      item.amazon_cost,
      item.amazon_cost_after_rebate,
      item.provider_cost,
      item.profit_loss,
      item.profit_loss_pct,
      item.match_status
    FROM jsonb_to_recordset(p_items) AS item(
      product_id UUID,
      barcode TEXT,
      asin TEXT,
      title TEXT,
      company_id UUID,
      order_qty INTEGER,
      boxes NUMERIC,
      amazon_cost NUMERIC,
      amazon_cost_after_rebate NUMERIC,
      provider_cost NUMERIC,
      profit_loss NUMERIC,
      profit_loss_pct NUMERIC,
      match_status TEXT
    )
    RETURNING provider_cost
  )
  SELECT count(*)::INTEGER, COALESCE(sum(provider_cost), 0)
    INTO v_saved, v_total_value
    FROM inserted;

  UPDATE public.order_batches
     SET total_items = v_saved,
         total_value = round(v_total_value, 2),
         updated_at = now()
   WHERE id = p_batch_id;

  RETURN QUERY SELECT v_saved, v_replaced, round(v_total_value, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_order_batch_items(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_order_batch_items(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.replace_order_batch_items(UUID, JSONB) IS
  'Atomically replaces all items in a draft order batch, serialized per batch for safe retries and duplicate submissions.';
