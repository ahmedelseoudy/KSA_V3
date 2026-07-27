-- Attribution: who submitted each availability response (company portal vs admin on behalf).
-- FK targets public.users_profile (not auth.users) so PostgREST can embed the responder's
-- email in one query; users_profile.id cascades from auth.users, so ON DELETE SET NULL
-- still fires when the underlying auth user is deleted.
-- Constraint is named explicitly (matches Postgres's default <table>_<column>_fkey
-- convention) because the API embeds it by name: users_profile!availability_responses_responded_by_fkey.
ALTER TABLE public.availability_responses
  ADD COLUMN IF NOT EXISTS responded_by UUID
    CONSTRAINT availability_responses_responded_by_fkey REFERENCES public.users_profile(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responded_by_role TEXT
    CHECK (responded_by_role IN ('company', 'admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_availability_responses_responded_by
  ON public.availability_responses(responded_by);

-- Backfill: every response answered before this migration came through the portal
-- (no admin write path existed), so attribute them to the company's portal user.
UPDATE public.availability_responses ar
SET responded_by_role = 'company',
    responded_by = c.user_id
FROM public.availability_orders ao
JOIN public.companies c ON c.id = ao.company_id
WHERE ar.availability_order_id = ao.id
  AND ar.responded_at IS NOT NULL
  AND ar.responded_by IS NULL;
