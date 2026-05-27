
-- Restrict direct column access to phone on profiles.
-- Reads of phone must go through public.get_user_phone(_uid) (SECURITY DEFINER), which already enforces self/admin access.
REVOKE SELECT (phone) ON public.profiles FROM anon;
REVOKE SELECT (phone) ON public.profiles FROM authenticated;

-- Grant SELECT on all other current columns explicitly so SELECT * (minus phone) continues to work for authenticated users.
GRANT SELECT (
  id, full_name, avatar_url, about_me,
  is_provider, is_coordinator, is_organization, is_client,
  language, created_at, updated_at,
  is_admin, is_verified, is_recruiter, is_featured, is_specialist,
  is_supplier, member_number, is_super_user, master_account_id
) ON public.profiles TO authenticated;
