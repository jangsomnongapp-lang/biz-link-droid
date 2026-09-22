-- Allow logged-out visitors to evaluate policies that call is_admin()
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;

-- Public, non-sensitive profile columns readable by logged-out visitors
GRANT SELECT (
  id, full_name, avatar_url, about_me, created_at, updated_at, language,
  member_number, is_featured, is_verified,
  is_provider, is_coordinator, is_organization, is_client, is_specialist,
  is_supplier, is_recruiter
) ON public.profiles TO anon;

DROP POLICY IF EXISTS "public profiles readable by visitors" ON public.profiles;
CREATE POLICY "public profiles readable by visitors"
ON public.profiles FOR SELECT TO anon USING (true);