ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS stock_updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_catalog_stock_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_status IS DISTINCT FROM OLD.stock_status
     OR NEW.in_stock IS DISTINCT FROM OLD.in_stock
     OR NEW.price IS DISTINCT FROM OLD.price THEN
    NEW.stock_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_catalog_stock_updated_at ON public.supplier_catalog_items;
CREATE TRIGGER trg_touch_catalog_stock_updated_at
BEFORE UPDATE ON public.supplier_catalog_items
FOR EACH ROW EXECUTE FUNCTION public.touch_catalog_stock_updated_at();

CREATE TABLE IF NOT EXISTS public.catalog_stock_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.supplier_catalog_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.supplier_stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'unavailable',
  note text,
  report_day date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_stock_reports_unique_per_day
  ON public.catalog_stock_reports (item_id, user_id, report_day);

GRANT INSERT, SELECT ON public.catalog_stock_reports TO authenticated;
GRANT ALL ON public.catalog_stock_reports TO service_role;

ALTER TABLE public.catalog_stock_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report a product"
  ON public.catalog_stock_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read stock reports"
  ON public.catalog_stock_reports FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));