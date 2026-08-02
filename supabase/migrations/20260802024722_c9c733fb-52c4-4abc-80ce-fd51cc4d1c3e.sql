ALTER TABLE public.supplier_stores
  ADD COLUMN IF NOT EXISTS fast_response boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_order numeric;

ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS offer_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_price numeric;

CREATE TABLE IF NOT EXISTS public.catalog_stock_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.supplier_catalog_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.supplier_stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.catalog_stock_notifications TO authenticated;
GRANT ALL ON public.catalog_stock_notifications TO service_role;

ALTER TABLE public.catalog_stock_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own stock alerts"
  ON public.catalog_stock_notifications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Store owners can view alerts on their items"
  ON public.catalog_stock_notifications FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_stores s
    WHERE s.id = catalog_stock_notifications.store_id AND s.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS catalog_stock_notifications_item_idx
  ON public.catalog_stock_notifications (item_id);

CREATE OR REPLACE FUNCTION public.notify_catalog_back_in_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_status <> 'out' AND OLD.stock_status = 'out' THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    SELECT n.user_id, 'catalog_back_in_stock', NEW.name_en,
           NEW.name_en || ' is back in stock.'
    FROM public.catalog_stock_notifications n
    WHERE n.item_id = NEW.id;

    DELETE FROM public.catalog_stock_notifications WHERE item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_catalog_back_in_stock ON public.supplier_catalog_items;
CREATE TRIGGER trg_notify_catalog_back_in_stock
  AFTER UPDATE OF stock_status ON public.supplier_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_catalog_back_in_stock();