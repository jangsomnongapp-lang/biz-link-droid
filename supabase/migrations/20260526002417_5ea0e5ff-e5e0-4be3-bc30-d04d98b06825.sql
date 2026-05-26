DROP POLICY "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
FOR UPDATE TO public
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin           = (SELECT p.is_admin           FROM profiles p WHERE p.id = auth.uid())
  AND is_super_user      = (SELECT p.is_super_user      FROM profiles p WHERE p.id = auth.uid())
  AND is_supplier        = (SELECT p.is_supplier        FROM profiles p WHERE p.id = auth.uid())
  AND is_recruiter       = (SELECT p.is_recruiter       FROM profiles p WHERE p.id = auth.uid())
  AND is_verified        = (SELECT p.is_verified        FROM profiles p WHERE p.id = auth.uid())
  AND is_featured        = (SELECT p.is_featured        FROM profiles p WHERE p.id = auth.uid())
  AND member_number  IS NOT DISTINCT FROM (SELECT p.member_number     FROM profiles p WHERE p.id = auth.uid())
  AND master_account_id IS NOT DISTINCT FROM (SELECT p.master_account_id FROM profiles p WHERE p.id = auth.uid())
);