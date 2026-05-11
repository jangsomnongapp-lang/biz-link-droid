-- Belt-and-suspenders: revoke column-level SELECT on profiles.phone for client roles
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;

-- Add WITH CHECK to user profile update policy to prevent privilege escalation
-- (defense in depth alongside the existing prevent_profile_privilege_escalation trigger)
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())
  AND is_super_user = (SELECT p.is_super_user FROM public.profiles p WHERE p.id = auth.uid())
  AND is_supplier = (SELECT p.is_supplier FROM public.profiles p WHERE p.id = auth.uid())
  AND is_recruiter = (SELECT p.is_recruiter FROM public.profiles p WHERE p.id = auth.uid())
  AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.id = auth.uid())
  AND is_featured = (SELECT p.is_featured FROM public.profiles p WHERE p.id = auth.uid())
  AND is_organization = (SELECT p.is_organization FROM public.profiles p WHERE p.id = auth.uid())
  AND is_coordinator = (SELECT p.is_coordinator FROM public.profiles p WHERE p.id = auth.uid())
  AND member_number IS NOT DISTINCT FROM (SELECT p.member_number FROM public.profiles p WHERE p.id = auth.uid())
  AND master_account_id IS NOT DISTINCT FROM (SELECT p.master_account_id FROM public.profiles p WHERE p.id = auth.uid())
);