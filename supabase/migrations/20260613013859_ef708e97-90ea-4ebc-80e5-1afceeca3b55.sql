DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);
DROP FUNCTION IF EXISTS public.get_public_supplier_stores(uuid[]);

DROP POLICY IF EXISTS "authenticated read public profiles" ON public.profiles;
CREATE POLICY "profiles are viewable by authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT (phone) ON TABLE public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, about_me, is_provider, is_coordinator, is_organization, is_client, is_admin, language, created_at, updated_at, is_verified, is_recruiter, is_featured, is_specialist, is_supplier, member_number, is_super_user, master_account_id) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "approved or own supplier stores readable" ON public.supplier_stores;
CREATE POLICY "approved or own supplier_stores readable"
ON public.supplier_stores
FOR SELECT
TO authenticated
USING (
  status = 'approved'
  OR auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

REVOKE SELECT (phone) ON TABLE public.supplier_stores FROM authenticated;
GRANT SELECT (id, user_id, name, location, description, logo_url, status, created_at, updated_at, view_count, contact_count) ON TABLE public.supplier_stores TO authenticated;