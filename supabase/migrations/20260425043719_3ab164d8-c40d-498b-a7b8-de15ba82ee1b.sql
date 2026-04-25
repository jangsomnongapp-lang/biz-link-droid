-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles
INSERT INTO public.profiles (id, full_name, phone, is_provider, is_coordinator, is_organization, is_client, language)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(u.raw_user_meta_data->>'phone', u.phone, ''),
  COALESCE((u.raw_user_meta_data->>'is_provider')::boolean, false),
  COALESCE((u.raw_user_meta_data->>'is_coordinator')::boolean, false),
  COALESCE((u.raw_user_meta_data->>'is_organization')::boolean, false),
  COALESCE((u.raw_user_meta_data->>'is_client')::boolean, false),
  COALESCE(u.raw_user_meta_data->>'language', 'en')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;