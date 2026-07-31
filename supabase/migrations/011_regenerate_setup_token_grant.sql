-- Authenticated admins use this function to issue a fresh company invite token
-- from the resend-invite and notification-retry API routes. The function itself
-- remains SECURITY DEFINER and enforces the caller's authorization checks.
GRANT EXECUTE ON FUNCTION public.regenerate_setup_token(uuid) TO authenticated;
