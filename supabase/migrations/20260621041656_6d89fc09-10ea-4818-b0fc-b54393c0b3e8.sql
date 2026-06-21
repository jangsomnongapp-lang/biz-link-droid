-- Revoke column-level SELECT on truly sensitive privilege flags from regular users.
-- These are not used in client-side queries; admin code uses get_my_profile_flags() RPC.
REVOKE SELECT (is_admin, is_super_user, master_account_id) ON public.profiles FROM authenticated;
REVOKE SELECT (is_admin, is_super_user, master_account_id) ON public.profiles FROM anon;
-- service_role keeps full access; admins read via has-role/is_admin SECURITY DEFINER helpers.