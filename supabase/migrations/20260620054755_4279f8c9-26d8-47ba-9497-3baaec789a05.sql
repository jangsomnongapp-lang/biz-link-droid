-- 1. Hide privileged profile columns from regular roles
REVOKE SELECT (is_admin, is_super_user, master_account_id) ON public.profiles FROM anon, authenticated;

-- Helper: current user's privileged flags
CREATE OR REPLACE FUNCTION public.get_my_profile_flags()
RETURNS TABLE(is_admin boolean, is_super_user boolean, master_account_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.is_admin, p.is_super_user, p.master_account_id
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile_flags() TO authenticated;

-- Helper: resolve the BuildHub Rewards account id (safe public lookup)
CREATE OR REPLACE FUNCTION public.get_rewards_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE is_super_user = true AND full_name ILIKE 'BuildHub Rewards'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_rewards_user_id() TO authenticated;

-- 2. Lock down suppressed_emails with restrictive deny-all for non-service roles
DROP POLICY IF EXISTS "deny authenticated all" ON public.suppressed_emails;
CREATE POLICY "deny authenticated all"
  ON public.suppressed_emails
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny anon all" ON public.suppressed_emails;
CREATE POLICY "deny anon all"
  ON public.suppressed_emails
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);