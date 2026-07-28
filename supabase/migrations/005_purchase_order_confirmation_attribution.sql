-- Attribution: who confirmed each purchase order (company portal vs admin on behalf).
-- Same pattern as 004_availability_response_attribution.sql: FK targets public.users_profile
-- (not auth.users) so PostgREST can embed the confirmer's email in one query, with an
-- explicit constraint name matching Postgres's default <table>_<column>_fkey convention
-- so the API can embed it by name if needed: users_profile!purchase_orders_confirmed_by_fkey.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS confirmed_by UUID
    CONSTRAINT purchase_orders_confirmed_by_fkey REFERENCES public.users_profile(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by_role TEXT
    CHECK (confirmed_by_role IN ('company', 'admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_purchase_orders_confirmed_by
  ON public.purchase_orders(confirmed_by);

-- Backfill: every PO confirmed before this migration went through the portal
-- (no admin write path existed), so attribute them to the company's portal user.
UPDATE public.purchase_orders po
SET confirmed_by_role = 'company',
    confirmed_by = c.user_id
FROM public.companies c
WHERE po.company_id = c.id
  AND po.confirmed_at IS NOT NULL
  AND po.confirmed_by IS NULL;
