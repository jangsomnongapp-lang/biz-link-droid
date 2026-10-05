CREATE TABLE public.store_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.supplier_stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);
CREATE INDEX store_followers_user_idx ON public.store_followers(user_id);
GRANT SELECT, INSERT, DELETE ON public.store_followers TO authenticated;
GRANT ALL ON public.store_followers TO service_role;
ALTER TABLE public.store_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own follows" ON public.store_followers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users follow others' stores" ON public.store_followers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = store_id AND s.user_id = auth.uid()));
CREATE POLICY "Users unfollow" ON public.store_followers FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.store_follower_counts(_store_ids uuid[])
RETURNS TABLE(store_id uuid, follower_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.store_id, count(*) FROM public.store_followers f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE f.store_id = ANY(_store_ids) GROUP BY f.store_id
$$;
GRANT EXECUTE ON FUNCTION public.store_follower_counts(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.followed_store_owner_ids()
RETURNS TABLE(owner_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id FROM public.store_followers f JOIN public.supplier_stores s ON s.id = f.store_id
  WHERE f.user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.followed_store_owner_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_followers_on_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store public.supplier_stores%ROWTYPE;
BEGIN
  IF NEW.post_type NOT IN ('oferta','liquidacion') THEN RETURN NEW; END IF;
  SELECT * INTO _store FROM public.supplier_stores WHERE user_id = NEW.user_id AND status = 'approved' LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_post_id)
  SELECT f.user_id, 'store_offer', _store.name,
    COALESCE(NULLIF(NEW.title,''), left(COALESCE(NEW.content,''), 120)),
    NEW.user_id, NEW.id
  FROM public.store_followers f WHERE f.store_id = _store.id AND f.user_id <> NEW.user_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_followers_on_offer AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_offer();