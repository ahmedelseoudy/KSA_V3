-- Phase 0 correctness fixes and reconciliation for columns that exist in production
-- but were missing from the migration history.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS availability_order_id UUID
    REFERENCES public.availability_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_availability_order_id
  ON public.purchase_orders(availability_order_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_date
  ON public.purchase_orders(delivery_date);

-- users_profile already has an own-row SELECT policy. Admin screens and attribution
-- embeds also need approved admins to be able to see all profile rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users_profile'
      AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON public.users_profile
      FOR SELECT
      USING (public.is_admin());
  END IF;
END
$$;

-- Prevent duplicate active POs while still allowing a cancelled PO to be re-issued.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchase_orders_batch_company_active
  ON public.purchase_orders(batch_id, company_id)
  WHERE status <> 'cancelled';

NOTIFY pgrst, 'reload schema';
