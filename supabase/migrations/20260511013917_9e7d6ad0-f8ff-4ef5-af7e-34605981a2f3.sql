
-- 1. Lock supplier_stores status & user_id on owner self-update
DROP POLICY IF EXISTS "owner updates own store" ON public.supplier_stores;
CREATE POLICY "owner updates own store"
ON public.supplier_stores
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = (SELECT s.status FROM public.supplier_stores s WHERE s.id = supplier_stores.id)
  AND user_id = (SELECT s.user_id FROM public.supplier_stores s WHERE s.id = supplier_stores.id)
);

-- 2. Replace direct INSERT on invite_joins with a validated SECURITY DEFINER RPC
DROP POLICY IF EXISTS "users insert own invite_join" ON public.invite_joins;

ALTER TABLE public.invite_joins
  ADD CONSTRAINT invite_joins_inviter_invitee_unique UNIQUE (inviter_id, invitee_id);

CREATE OR REPLACE FUNCTION public.record_invite_join(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inviter uuid;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT user_id INTO _inviter FROM public.invite_codes WHERE code = _code LIMIT 1;
  IF _inviter IS NULL OR _inviter = auth.uid() THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.invite_joins (inviter_id, invitee_id, code)
  VALUES (_inviter, auth.uid(), _code)
  ON CONFLICT (inviter_id, invitee_id) DO NOTHING
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_invite_join(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_invite_join(text) TO authenticated;

-- 3. Restrict rental-photos storage policies to authenticated role explicitly
DROP POLICY IF EXISTS "Users can upload to own rental folder" ON storage.objects;
CREATE POLICY "Users can upload to own rental folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rental-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own rental folder files" ON storage.objects;
CREATE POLICY "Users can delete own rental folder files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'rental-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);
