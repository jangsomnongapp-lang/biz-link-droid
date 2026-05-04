
-- =========================================================
-- 1. PROFILES: prevent self-privilege escalation
-- =========================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins (and the service role / triggers running as superuser)
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
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
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- =========================================================
-- 2. PROFILES: hide phone column from other users
-- =========================================================
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_phone(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone FROM public.profiles
  WHERE id = _uid
    AND (auth.uid() = _uid OR public.is_admin(auth.uid()));
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_phone(uuid) TO authenticated;

-- =========================================================
-- 3. INVITE_REWARDS: only admins can insert directly
-- =========================================================
DROP POLICY IF EXISTS "system inserts rewards" ON public.invite_rewards;
CREATE POLICY "admins insert rewards"
ON public.invite_rewards
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- 4. SUPPLIER_INVITES: token lookup via SECURITY DEFINER fn
-- =========================================================
DROP POLICY IF EXISTS "anyone can read supplier invite by token" ON public.supplier_invites;

CREATE OR REPLACE FUNCTION public.get_supplier_invite_by_token(_token text)
RETURNS TABLE (id uuid, used_by uuid, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, used_by, expires_at
  FROM public.supplier_invites
  WHERE token = _token
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_invite_by_token(text) TO anon, authenticated;

-- Allow invitee to mark used by token (the existing UPDATE policy still uses auth.uid() = used_by)
-- The update from client uses .eq('token', token); that requires SELECT on the row. Provide a definer fn.
CREATE OR REPLACE FUNCTION public.consume_supplier_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_supplier_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_supplier_invite(text) TO authenticated;

-- =========================================================
-- 5. INVITE_CODES: hide from public; provide resolver fn
-- =========================================================
DROP POLICY IF EXISTS "invite_codes readable by everyone" ON public.invite_codes;
CREATE POLICY "users read own invite_code"
ON public.invite_codes
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.resolve_invite_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.invite_codes WHERE code = _code LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_invite_code(text) TO anon, authenticated;

-- =========================================================
-- 6. INVITE_CLICKS: prevent open inserts; provide validated fn
-- =========================================================
DROP POLICY IF EXISTS "anyone can insert invite_clicks" ON public.invite_clicks;
-- (no insert policy = no inserts via PostgREST except through definer function)

CREATE OR REPLACE FUNCTION public.record_invite_click(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inviter uuid;
BEGIN
  SELECT user_id INTO _inviter FROM public.invite_codes WHERE code = _code LIMIT 1;
  IF _inviter IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.invite_clicks (code, inviter_id) VALUES (_code, _inviter);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_invite_click(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_invite_click(text) TO anon, authenticated;

-- =========================================================
-- 7. INVITE_JOINS: scope reads
-- =========================================================
DROP POLICY IF EXISTS "invite_joins readable by auth" ON public.invite_joins;
CREATE POLICY "users read own invite_joins"
ON public.invite_joins
FOR SELECT TO authenticated
USING (
  auth.uid() = inviter_id
  OR auth.uid() = invitee_id
  OR public.is_admin(auth.uid())
);

-- =========================================================
-- 8. LISTINGS: hide non-approved from non-owners
-- =========================================================
DROP POLICY IF EXISTS "listings readable by auth" ON public.listings;
CREATE POLICY "approved or own listings readable"
ON public.listings
FOR SELECT TO authenticated
USING (
  status = 'approved'
  OR auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

-- =========================================================
-- 9. SUPPLIER_STORES: hide non-approved from non-owners
-- =========================================================
DROP POLICY IF EXISTS "supplier_stores readable by auth" ON public.supplier_stores;
CREATE POLICY "approved or own supplier_stores readable"
ON public.supplier_stores
FOR SELECT TO authenticated
USING (
  status = 'approved'
  OR auth.uid() = user_id
  OR public.is_admin(auth.uid())
);
