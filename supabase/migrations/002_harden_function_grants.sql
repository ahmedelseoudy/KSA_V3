-- Revoke EXECUTE from anon on internal functions (not needed pre-auth)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_all_products_for_matching(integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_company_user(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.regenerate_setup_token(uuid) FROM anon, public;

-- Trigger functions: not callable via RPC by anyone
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_registration() FROM anon, authenticated, public;

-- Note: validate_setup_token and complete_password_setup intentionally remain
-- executable by anon: they power the pre-auth password setup flow and validate
-- a single-use token internally.
