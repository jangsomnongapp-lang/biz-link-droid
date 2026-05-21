-- Protect supplier store phone numbers from broad authenticated reads.
REVOKE SELECT (phone) ON public.supplier_stores FROM anon, authenticated;

-- Controlled access for store owners/admins that need to edit or manage a supplier store.
CREATE OR REPLACE FUNCTION public.get_supplier_store_phone(_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.phone
  FROM public.supplier_stores s
  WHERE s.id = _store_id
    AND (
      s.user_id = auth.uid()
      OR public.is_admin(auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_store_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supplier_store_phone(uuid) TO authenticated;