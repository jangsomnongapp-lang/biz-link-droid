-- Defense in depth: explicitly revoke SELECT on sensitive phone column
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated, PUBLIC;
COMMENT ON COLUMN public.profiles.phone IS 'Sensitive: SELECT revoked from anon/authenticated. Access only via get_user_phone() security definer function for the owner.';