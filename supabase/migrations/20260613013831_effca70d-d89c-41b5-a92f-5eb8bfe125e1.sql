REVOKE ALL ON TABLE public.email_send_log FROM anon, authenticated;
GRANT ALL ON TABLE public.email_send_log TO service_role;

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, avatar_url, about_me, is_provider, is_coordinator, is_organization, is_client, language, created_at, updated_at, is_verified, is_recruiter, is_featured, is_specialist, is_supplier, member_number) ON TABLE public.profiles TO authenticated;
GRANT SELECT (phone, is_admin, is_super_user, master_account_id) ON TABLE public.profiles TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

DROP POLICY IF EXISTS "profiles are viewable by authenticated" ON public.profiles;
CREATE POLICY "authenticated read public profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin(auth.uid())
  OR (
    phone IS NULL
    AND is_admin = false
    AND is_super_user = false
    AND master_account_id IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  about_me text,
  is_provider boolean,
  is_coordinator boolean,
  is_organization boolean,
  is_client boolean,
  language text,
  created_at timestamptz,
  updated_at timestamptz,
  is_verified boolean,
  is_recruiter boolean,
  is_featured boolean,
  is_specialist boolean,
  is_supplier boolean,
  member_number bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.about_me,
         p.is_provider, p.is_coordinator, p.is_organization, p.is_client,
         p.language, p.created_at, p.updated_at, p.is_verified,
         p.is_recruiter, p.is_featured, p.is_specialist, p.is_supplier,
         p.member_number
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(COALESCE(_ids, ARRAY[]::uuid[]));
$$;
REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;

REVOKE ALL ON TABLE public.supplier_stores FROM anon, authenticated;
GRANT SELECT (id, user_id, name, location, description, logo_url, status, created_at, updated_at, view_count, contact_count) ON TABLE public.supplier_stores TO authenticated;
GRANT SELECT (phone) ON TABLE public.supplier_stores TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.supplier_stores TO authenticated;
GRANT ALL ON TABLE public.supplier_stores TO service_role;

DROP POLICY IF EXISTS "approved or own supplier_stores readable" ON public.supplier_stores;
CREATE POLICY "approved or own supplier stores readable"
ON public.supplier_stores
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR (status = 'approved' AND phone IS NULL)
);

CREATE OR REPLACE FUNCTION public.get_public_supplier_stores(_store_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  location text,
  description text,
  logo_url text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  view_count integer,
  contact_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.user_id, s.name, s.location, s.description, s.logo_url,
         s.status, s.created_at, s.updated_at, s.view_count, s.contact_count
  FROM public.supplier_stores s
  WHERE auth.uid() IS NOT NULL
    AND s.status = 'approved'
    AND (_store_ids IS NULL OR s.id = ANY(_store_ids));
$$;
REVOKE ALL ON FUNCTION public.get_public_supplier_stores(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_supplier_stores(uuid[]) TO authenticated, service_role;