CREATE TABLE public.marketplace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('retail', 'secondhand')),
  title text NOT NULL,
  description text,
  price numeric,
  currency text NOT NULL DEFAULT 'USD',
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.marketplace_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_items TO authenticated;
GRANT ALL ON public.marketplace_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_item_photos TO authenticated;
GRANT ALL ON public.marketplace_item_photos TO service_role;

ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_item_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active marketplace items"
  ON public.marketplace_items FOR SELECT TO authenticated
  USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Users can create their own marketplace items"
  ON public.marketplace_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update their marketplace items"
  ON public.marketplace_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete their marketplace items"
  ON public.marketplace_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can view marketplace item photos"
  ON public.marketplace_item_photos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owners can add photos to their items"
  ON public.marketplace_item_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_items mi WHERE mi.id = item_id AND mi.user_id = auth.uid()));

CREATE POLICY "Owners can delete photos from their items"
  ON public.marketplace_item_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_items mi WHERE mi.id = item_id AND mi.user_id = auth.uid()));

CREATE TRIGGER set_marketplace_items_updated_at
  BEFORE UPDATE ON public.marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();