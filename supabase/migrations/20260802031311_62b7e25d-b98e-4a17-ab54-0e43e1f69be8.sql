CREATE OR REPLACE FUNCTION public.catalog_stats(_store_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_province text;
  v_days integer := greatest(1, least(coalesce(_days, 7), 120));
  v_start timestamptz;
  v_prev_start timestamptz;
  v_views bigint; v_prev_views bigint;
  v_reqs bigint; v_prev_reqs bigint;
  v_chats bigint; v_prev_chats bigint;
  v_resp numeric;
  v_daily jsonb;
  v_top jsonb;
  v_gaps jsonb;
  v_opportunity jsonb;
  v_attention jsonb;
BEGIN
  SELECT user_id, location INTO v_owner, v_province FROM supplier_stores WHERE id = _store_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_start := now() - (v_days || ' days')::interval;
  v_prev_start := now() - (2 * v_days || ' days')::interval;

  SELECT
    count(*) FILTER (WHERE event_type = 'view' AND created_at >= v_start),
    count(*) FILTER (WHERE event_type = 'view' AND created_at >= v_prev_start AND created_at < v_start),
    count(*) FILTER (WHERE event_type = 'request' AND created_at >= v_start),
    count(*) FILTER (WHERE event_type = 'request' AND created_at >= v_prev_start AND created_at < v_start),
    count(*) FILTER (WHERE event_type = 'chat' AND created_at >= v_start),
    count(*) FILTER (WHERE event_type = 'chat' AND created_at >= v_prev_start AND created_at < v_start)
  INTO v_views, v_prev_views, v_reqs, v_prev_reqs, v_chats, v_prev_chats
  FROM catalog_item_events
  WHERE store_id = _store_id AND created_at >= v_prev_start;

  WITH inbound AS (
    SELECT t.id
    FROM message_threads t
    JOIN messages m ON m.thread_id = t.id AND m.sender_id <> v_owner AND m.created_at >= v_start
    WHERE v_owner IN (t.participant_a, t.participant_b)
    GROUP BY t.id
  ), answered AS (
    SELECT i.id FROM inbound i
    WHERE EXISTS (
      SELECT 1 FROM messages m2
      WHERE m2.thread_id = i.id AND m2.sender_id = v_owner AND m2.created_at >= v_start
    )
  )
  SELECT CASE WHEN (SELECT count(*) FROM inbound) = 0 THEN NULL
              ELSE round(100.0 * (SELECT count(*) FROM answered) / (SELECT count(*) FROM inbound)) END
  INTO v_resp;

  SELECT coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', c) ORDER BY d), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT gs.d, (
      SELECT count(*) FROM catalog_item_events e
      WHERE e.store_id = _store_id AND e.event_type = 'request'
        AND e.created_at >= gs.d AND e.created_at < gs.d + interval '1 day'
    ) AS c
    FROM generate_series(date_trunc('day', v_start), date_trunc('day', now()), interval '1 day') gs(d)
  ) q;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_top FROM (
    SELECT jsonb_build_object('id', i.id, 'name_en', i.name_en, 'name_km', i.name_km, 'count', count(e.id)) AS x
    FROM supplier_catalog_items i
    JOIN catalog_item_events e ON e.item_id = i.id AND e.event_type = 'request' AND e.created_at >= v_start
    WHERE i.store_id = _store_id
    GROUP BY i.id, i.name_en, i.name_km
    ORDER BY count(e.id) DESC
    LIMIT 5
  ) q;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_gaps FROM (
    SELECT jsonb_build_object('term', s.term, 'count', count(*)) AS x
    FROM catalog_search_events s
    WHERE s.created_at >= v_start
      AND (v_province IS NULL OR s.province IS NULL OR s.province = v_province)
      AND NOT EXISTS (
        SELECT 1 FROM supplier_catalog_items i
        WHERE i.store_id = _store_id
          AND (i.name_en ILIKE '%' || s.term || '%' OR coalesce(i.name_km, '') ILIKE '%' || s.term || '%')
      )
    GROUP BY s.term
    ORDER BY count(*) DESC
    LIMIT 6
  ) q;

  SELECT jsonb_build_object('term', term, 'count', cnt) INTO v_opportunity FROM (
    SELECT s.term, count(*) AS cnt
    FROM catalog_search_events s
    WHERE s.created_at >= v_start
      AND (v_province IS NULL OR s.province IS NULL OR s.province = v_province)
      AND NOT EXISTS (
        SELECT 1 FROM supplier_catalog_items i
        JOIN supplier_stores st ON st.id = i.store_id
        WHERE (v_province IS NULL OR st.location = v_province)
          AND (i.name_en ILIKE '%' || s.term || '%' OR coalesce(i.name_km, '') ILIKE '%' || s.term || '%')
      )
    GROUP BY s.term
    ORDER BY count(*) DESC
    LIMIT 1
  ) q;

  SELECT jsonb_build_object('name_en', name_en, 'name_km', name_km, 'count', cnt) INTO v_attention FROM (
    SELECT i.name_en, i.name_km, count(e.id) AS cnt
    FROM supplier_catalog_items i
    JOIN catalog_item_events e ON e.item_id = i.id AND e.event_type = 'request' AND e.created_at >= v_start
    WHERE i.store_id = _store_id AND coalesce(i.stock_status, 'in_stock') = 'out'
    GROUP BY i.name_en, i.name_km
    ORDER BY count(e.id) DESC
    LIMIT 1
  ) q;

  RETURN jsonb_build_object(
    'days', v_days,
    'views', v_views, 'prev_views', v_prev_views,
    'requests', v_reqs, 'prev_requests', v_prev_reqs,
    'chats', v_chats, 'prev_chats', v_prev_chats,
    'response_rate', v_resp,
    'daily', v_daily,
    'top_products', v_top,
    'search_gaps', v_gaps,
    'opportunity', v_opportunity,
    'attention', v_attention
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_stats(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.catalog_stats(uuid, integer) TO authenticated;