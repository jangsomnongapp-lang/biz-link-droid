
-- 1. Replace profiles UPDATE policy to also lock role flags
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;

CREATE POLICY "users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin           IS NOT DISTINCT FROM (SELECT p.is_admin           FROM public.profiles p WHERE p.id = profiles.id)
  AND is_super_user      IS NOT DISTINCT FROM (SELECT p.is_super_user      FROM public.profiles p WHERE p.id = profiles.id)
  AND is_supplier        IS NOT DISTINCT FROM (SELECT p.is_supplier        FROM public.profiles p WHERE p.id = profiles.id)
  AND is_recruiter       IS NOT DISTINCT FROM (SELECT p.is_recruiter       FROM public.profiles p WHERE p.id = profiles.id)
  AND is_verified        IS NOT DISTINCT FROM (SELECT p.is_verified        FROM public.profiles p WHERE p.id = profiles.id)
  AND is_featured        IS NOT DISTINCT FROM (SELECT p.is_featured        FROM public.profiles p WHERE p.id = profiles.id)
  AND member_number      IS NOT DISTINCT FROM (SELECT p.member_number      FROM public.profiles p WHERE p.id = profiles.id)
  AND master_account_id  IS NOT DISTINCT FROM (SELECT p.master_account_id  FROM public.profiles p WHERE p.id = profiles.id)
  AND is_specialist      IS NOT DISTINCT FROM (SELECT p.is_specialist      FROM public.profiles p WHERE p.id = profiles.id)
  AND is_coordinator     IS NOT DISTINCT FROM (SELECT p.is_coordinator     FROM public.profiles p WHERE p.id = profiles.id)
  AND is_provider        IS NOT DISTINCT FROM (SELECT p.is_provider        FROM public.profiles p WHERE p.id = profiles.id)
  AND is_client          IS NOT DISTINCT FROM (SELECT p.is_client          FROM public.profiles p WHERE p.id = profiles.id)
  AND is_organization    IS NOT DISTINCT FROM (SELECT p.is_organization    FROM public.profiles p WHERE p.id = profiles.id)
);

-- Note: the prevent_profile_privilege_escalation trigger remains as defense-in-depth.
-- The user app updates these role flags via UI; that path now requires admin or going through definer functions.
-- Since edit-profile UI sets is_provider/is_coordinator/is_organization/is_client directly, we keep app behavior by
-- routing through a security-definer RPC. Provide such RPC:

CREATE OR REPLACE FUNCTION public.update_my_role_flags(
  _is_provider boolean,
  _is_coordinator boolean,
  _is_organization boolean,
  _is_client boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
     SET is_provider = COALESCE(_is_provider, is_provider),
         is_coordinator = COALESCE(_is_coordinator, is_coordinator),
         is_organization = COALESCE(_is_organization, is_organization),
         is_client = COALESCE(_is_client, is_client)
   WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_role_flags(boolean, boolean, boolean, boolean) TO authenticated;

-- 2. Explicit deny-read policies for sensitive tables
CREATE POLICY "deny authenticated read"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "deny authenticated read"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "deny non-admin authenticated read"
ON public.supplier_invites
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
