
-- 1. Update handle_new_user to ignore is_supplier from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone, is_provider, is_coordinator, is_organization, is_client, is_specialist, is_supplier, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    coalesce((new.raw_user_meta_data->>'is_provider')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_coordinator')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_organization')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_client')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_specialist')::boolean, false),
    false, -- is_supplier: only granted via consume_supplier_invite RPC
    coalesce(new.raw_user_meta_data->>'language', 'km')
  );
  return new;
end;
$function$;

-- 2. consume_supplier_invite now flips the profile is_supplier flag (bypassing the privilege escalation trigger via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.consume_supplier_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.supplier_invites
     SET used_by = auth.uid(), used_at = now()
   WHERE token = _token
     AND used_by IS NULL
     AND (expires_at IS NULL OR expires_at > now())
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already-used invite';
  END IF;

  -- Grant supplier privilege via direct UPDATE (SECURITY DEFINER bypasses RLS;
  -- the prevent_profile_privilege_escalation trigger allows admin-context updates,
  -- but this runs as the function owner which is treated as elevated context).
  UPDATE public.profiles SET is_supplier = true WHERE id = auth.uid();

  RETURN _id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_supplier_invite(text) FROM anon, public;

-- 3. Restrict supplier_stores INSERT to users who have actually been granted is_supplier
DROP POLICY IF EXISTS "owner inserts own store" ON public.supplier_stores;
CREATE POLICY "owner inserts own store"
ON public.supplier_stores
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_supplier = true
  )
);

-- 4. The privilege escalation trigger needs to allow the SECURITY DEFINER RPC to flip is_supplier.
-- Update it to allow flipping is_supplier when called from consume_supplier_invite context.
-- Easiest: allow is_supplier to go from false -> true if there's an unconsumed-but-now-consumed invite.
-- Simpler: detect SECURITY DEFINER context via session_user vs current_user.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Allow admins, service role, or trigger/RPC contexts (current_user differs from session_user when running inside SECURITY DEFINER)
  IF auth.uid() IS NULL
     OR public.is_admin(auth.uid())
     OR current_user <> session_user THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin       IS DISTINCT FROM OLD.is_admin
  OR NEW.is_supplier    IS DISTINCT FROM OLD.is_supplier
  OR NEW.is_featured    IS DISTINCT FROM OLD.is_featured
  OR NEW.is_recruiter   IS DISTINCT FROM OLD.is_recruiter
  OR NEW.is_verified    IS DISTINCT FROM OLD.is_verified
  OR NEW.member_number  IS DISTINCT FROM OLD.member_number THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
