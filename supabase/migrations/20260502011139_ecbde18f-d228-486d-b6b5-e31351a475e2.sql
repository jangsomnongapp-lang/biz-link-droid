ALTER TABLE public.supplier_stores
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_supplier_view(_store_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.supplier_stores SET view_count = view_count + 1 WHERE id = _store_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_supplier_contact(_store_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.supplier_stores SET contact_count = contact_count + 1 WHERE id = _store_id;
$$;