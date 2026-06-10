-- Lightweight keep-alive ping to prevent free-tier auto-pause.
-- Safe: returns only the current timestamp, no data access.
CREATE OR REPLACE FUNCTION public.keep_alive_ping()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = ''
AS $$ SELECT now(); $$;

GRANT EXECUTE ON FUNCTION public.keep_alive_ping() TO anon, authenticated;
