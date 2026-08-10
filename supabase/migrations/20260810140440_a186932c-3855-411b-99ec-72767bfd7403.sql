-- Make supplier invite consumption idempotent for the same user.
-- Before this, a retry after a failed store insert would fail with
-- "Invalid or already-used invite" because the invite was already marked used.

CREATE OR REPLACE FUNCTION public.consume_supplier_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _id uuid;
  _existing_used_by uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If this user already consumed this invite, treat the call as a no-op success.
  SELECT id, used_by INTO _id, _existing_used_by
  FROM public.supplier_invites
  WHERE token = _token;

  IF _id IS NOT NULL AND _existing_used_by = auth.uid() THEN
    -- Ensure the supplier flag is still set (in case the previous attempt failed before this).
    UPDATE public.profiles SET is_supplier = true WHERE id = auth.uid();
    RETURN _id;
  END IF;

  IF _id IS NOT NULL AND _existing_used_by IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already used by another user';
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

  UPDATE public.profiles SET is_supplier = true WHERE id = auth.uid();

  RETURN _id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_supplier_invite(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consume_supplier_invite(text) TO authenticated;
