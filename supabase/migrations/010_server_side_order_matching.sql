-- Match and atomically replace order items in one database round trip. This
-- avoids downloading the full product catalog before every order import.

CREATE INDEX IF NOT EXISTS idx_products_normalized_barcode
  ON public.products ((regexp_replace(barcode, '[[:space:],]', '', 'g')));

ALTER TABLE public.order_batches
  ADD COLUMN IF NOT EXISTS import_fingerprint TEXT;

CREATE OR REPLACE FUNCTION public.match_and_replace_order_batch_items(
  p_batch_id UUID,
  p_items JSONB
)
RETURNS TABLE(
  saved INTEGER,
  replaced INTEGER,
  matched INTEGER,
  missing INTEGER,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_batch_status TEXT;
  v_saved INTEGER := 0;
  v_replaced INTEGER := 0;
  v_matched INTEGER := 0;
  v_missing INTEGER := 0;
  v_total_value NUMERIC := 0;
  v_batch_total_items INTEGER := 0;
  v_previous_fingerprint TEXT;
  v_fingerprint TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 10000 THEN
    RAISE EXCEPTION 'items must contain between 1 and 10000 rows' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_batch_id::TEXT, 0));

  v_fingerprint := md5(p_items::TEXT);

  SELECT status, total_items, import_fingerprint
    INTO v_batch_status, v_batch_total_items, v_previous_fingerprint
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
       , count(*) FILTER (WHERE match_status = 'matched')::INTEGER
       , count(*) FILTER (WHERE match_status = 'missing')::INTEGER
       , COALESCE(sum(provider_cost), 0)
    INTO v_replaced, v_matched, v_missing, v_total_value
    FROM public.order_items
   WHERE batch_id = p_batch_id;

  -- An identical completed retry is already durable. Returning the current
  -- counts avoids rewriting thousands of unchanged rows. The row-count check
  -- prevents a stale fingerprint from masking out-of-band item edits.
  IF v_previous_fingerprint = v_fingerprint
     AND v_replaced = v_batch_total_items
     AND v_replaced > 0 THEN
    RETURN QUERY SELECT
      v_replaced,
      v_replaced,
      v_matched,
      v_missing,
      round(v_total_value, 2);
    RETURN;
  END IF;

  DELETE FROM public.order_items WHERE batch_id = p_batch_id;

  WITH parsed AS (
    SELECT
      item.barcode,
      NULLIF(btrim(item.asin), '') AS asin,
      NULLIF(btrim(item.title), '') AS title,
      item.order_qty,
      item.amazon_cost
    FROM jsonb_to_recordset(p_items) AS item(
      barcode TEXT,
      asin TEXT,
      title TEXT,
      order_qty INTEGER,
      amazon_cost NUMERIC
    )
  ), matched_rows AS (
    SELECT
      parsed.*,
      product.id AS product_id,
      product.company_id,
      product.title AS product_title,
      product.box_quantity,
      product.price_per_box,
      CASE
        WHEN product.id IS NOT NULL AND product.box_quantity > 0
          THEN parsed.order_qty::NUMERIC / product.box_quantity
        ELSE 0
      END AS raw_boxes
    FROM parsed
    LEFT JOIN public.products AS product
      ON regexp_replace(product.barcode, '[[:space:],]', '', 'g') = parsed.barcode
  ), calculated AS (
    SELECT
      matched_rows.*,
      round(raw_boxes, 2) AS boxes,
      round(amazon_cost * 0.95, 2) AS cost_after_rebate,
      round(raw_boxes * COALESCE(price_per_box, 0), 2) AS provider_cost
    FROM matched_rows
  ), ready AS (
    SELECT
      calculated.*,
      round(cost_after_rebate - provider_cost, 2) AS profit_loss,
      CASE
        WHEN provider_cost <> 0
          THEN round(((cost_after_rebate - provider_cost) / provider_cost) * 100, 2)
        ELSE 0
      END AS profit_loss_pct
    FROM calculated
  ), inserted AS (
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
      product_id,
      barcode,
      asin,
      COALESCE(title, product_title),
      company_id,
      order_qty,
      boxes,
      round(amazon_cost, 2),
      cost_after_rebate,
      provider_cost,
      profit_loss,
      profit_loss_pct,
      CASE WHEN product_id IS NULL THEN 'missing' ELSE 'matched' END
    FROM ready
    RETURNING match_status, provider_cost
  )
  SELECT
    count(*)::INTEGER,
    count(*) FILTER (WHERE match_status = 'matched')::INTEGER,
    count(*) FILTER (WHERE match_status = 'missing')::INTEGER,
    COALESCE(sum(provider_cost), 0)
    INTO v_saved, v_matched, v_missing, v_total_value
    FROM inserted;

  UPDATE public.order_batches
     SET total_items = v_saved,
         total_value = round(v_total_value, 2),
         import_fingerprint = v_fingerprint,
         updated_at = now()
   WHERE id = p_batch_id;

  RETURN QUERY SELECT
    v_saved,
    v_replaced,
    v_matched,
    v_missing,
    round(v_total_value, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.match_and_replace_order_batch_items(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_and_replace_order_batch_items(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.match_and_replace_order_batch_items(UUID, JSONB) IS
  'Matches product barcodes and atomically replaces a draft batch in one serialized transaction.';
