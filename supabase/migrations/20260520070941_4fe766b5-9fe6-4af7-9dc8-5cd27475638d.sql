-- Remove column-level SELECT on profiles.phone for client roles.
-- Phone access for owner/admin remains available via public.get_user_phone(uuid) SECURITY DEFINER function.
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;