
-- posts: lock status to current value on self-update
DROP POLICY IF EXISTS "users update own posts" ON public.posts;
CREATE POLICY "users update own posts" ON public.posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT p.status FROM public.posts p WHERE p.id = posts.id)
    AND user_id = (SELECT p.user_id FROM public.posts p WHERE p.id = posts.id)
  );

-- listings
DROP POLICY IF EXISTS "users update own listings" ON public.listings;
CREATE POLICY "users update own listings" ON public.listings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT l.status FROM public.listings l WHERE l.id = listings.id)
    AND user_id = (SELECT l.user_id FROM public.listings l WHERE l.id = listings.id)
  );

-- stories
DROP POLICY IF EXISTS "users update own stories" ON public.stories;
CREATE POLICY "users update own stories" ON public.stories
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT s.status FROM public.stories s WHERE s.id = stories.id)
    AND user_id = (SELECT s.user_id FROM public.stories s WHERE s.id = stories.id)
  );

-- rental_listings: keep admin override path
DROP POLICY IF EXISTS "Users can update their own rentals" ON public.rental_listings;
CREATE POLICY "Users can update their own rentals" ON public.rental_listings
  FOR UPDATE
  USING ((auth.uid() = user_id) OR is_admin(auth.uid()))
  WITH CHECK (
    is_admin(auth.uid())
    OR (
      auth.uid() = user_id
      AND status = (SELECT r.status FROM public.rental_listings r WHERE r.id = rental_listings.id)
      AND user_id = (SELECT r.user_id FROM public.rental_listings r WHERE r.id = rental_listings.id)
    )
  );
