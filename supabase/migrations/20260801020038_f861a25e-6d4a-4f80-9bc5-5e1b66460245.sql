CREATE TABLE public.catalog_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.supplier_catalog_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.supplier_stores(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.catalog_item_events TO authenticated;
GRANT INSERT ON public.catalog_item_events TO anon;
GRANT ALL ON public.catalog_item_events TO service_role;
ALTER TABLE public.catalog_item_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can record catalogue activity"
  ON public.catalog_item_events FOR INSERT TO anon, authenticated
  WITH CHECK (event_type IN ('view','chat','request'));

CREATE POLICY "store owners read their catalogue activity"
  ON public.catalog_item_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_stores s
    WHERE s.id = catalog_item_events.store_id AND s.user_id = auth.uid()
  ));

CREATE INDEX idx_catalog_item_events_store ON public.catalog_item_events(store_id, created_at DESC);
CREATE INDEX idx_catalog_item_events_item ON public.catalog_item_events(item_id, event_type);

CREATE TABLE public.catalog_search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  province text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.catalog_search_events TO anon, authenticated;
GRANT ALL ON public.catalog_search_events TO service_role;
ALTER TABLE public.catalog_search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can record catalogue searches"
  ON public.catalog_search_events FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(term) BETWEEN 1 AND 120);

CREATE INDEX idx_catalog_search_events_recent ON public.catalog_search_events(created_at DESC);

CREATE OR REPLACE FUNCTION public.catalog_market_searches(_province text DEFAULT NULL, _limit integer DEFAULT 6)
RETURNS TABLE (term text, search_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(e.term) AS term, count(*) AS search_count
  FROM public.catalog_search_events e
  WHERE e.created_at > now() - interval '7 days'
    AND (_province IS NULL OR e.province = _province)
  GROUP BY lower(e.term)
  ORDER BY count(*) DESC, lower(e.term)
  LIMIT LEAST(GREATEST(COALESCE(_limit, 6), 1), 20)
$$;

GRANT EXECUTE ON FUNCTION public.catalog_market_searches(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.catalog_panel_stats(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supplier_stores s WHERE s.id = _store_id AND s.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  WITH items AS (
    SELECT i.id, i.name_en, i.category_id, COALESCE(i.stock_status, CASE WHEN i.in_stock THEN 'in_stock' ELSE 'out' END) AS stock_status
    FROM public.supplier_catalog_items i
    WHERE i.store_id = _store_id
  ),
  ev AS (
    SELECT e.item_id, e.event_type, e.created_at
    FROM public.catalog_item_events e
    WHERE e.store_id = _store_id
  ),
  per_item AS (
    SELECT it.id,
      it.name_en,
      it.stock_status,
      (SELECT count(*) FROM ev WHERE ev.item_id = it.id AND ev.event_type = 'view') AS views,
      (SELECT count(*) FROM ev WHERE ev.item_id = it.id AND ev.event_type = 'chat') AS chats,
      (SELECT count(*) FROM ev WHERE ev.item_id = it.id AND ev.event_type = 'request'
         AND ev.created_at > now() - interval '7 days') AS requests_week
    FROM items it
  )
  SELECT jsonb_build_object(
    'total_products', (SELECT count(*) FROM items),
    'category_count', (SELECT count(DISTINCT category_id) FROM items WHERE category_id IS NOT NULL),
    'in_stock', (SELECT count(*) FROM items WHERE stock_status <> 'out'),
    'out_of_stock', (SELECT count(*) FROM items WHERE stock_status = 'out'),
    'requests_week', (SELECT count(*) FROM ev WHERE event_type = 'request' AND created_at > now() - interval '7 days'),
    'requests_prev_week', (SELECT count(*) FROM ev WHERE event_type = 'request'
        AND created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days'),
    'most_requested', (SELECT jsonb_build_object('id', id, 'name', name_en, 'requests', requests_week)
        FROM per_item ORDER BY requests_week DESC, name_en LIMIT 1),
    'alert', (SELECT jsonb_build_object('id', id, 'name', name_en, 'requests', requests_week)
        FROM per_item WHERE stock_status = 'out' AND requests_week > 0
        ORDER BY requests_week DESC LIMIT 1),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'views', views, 'chats', chats, 'requests_week', requests_week)) FROM per_item), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.catalog_panel_stats(uuid) TO authenticated;