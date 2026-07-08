
DROP POLICY IF EXISTS "likes readable by auth" ON public.post_likes;
CREATE POLICY "likes readable by auth" ON public.post_likes
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_likes.post_id
      AND (p.status = 'approved' OR p.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "comments readable by auth" ON public.post_comments;
CREATE POLICY "comments readable by auth" ON public.post_comments
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND (p.status = 'approved' OR p.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "comment_likes readable by auth" ON public.comment_likes;
CREATE POLICY "comment_likes readable by auth" ON public.comment_likes
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.post_comments c
    JOIN public.posts p ON p.id = c.post_id
    WHERE c.id = comment_likes.comment_id
      AND (p.status = 'approved' OR p.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "rental_likes readable by auth" ON public.rental_likes;
CREATE POLICY "rental_likes readable by auth" ON public.rental_likes
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.rental_listings r
    WHERE r.id = rental_likes.rental_id
      AND (r.status = 'approved' OR r.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "rental_comments readable by auth" ON public.rental_comments;
CREATE POLICY "rental_comments readable by auth" ON public.rental_comments
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.rental_listings r
    WHERE r.id = rental_comments.rental_id
      AND (r.status = 'approved' OR r.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "rental_comment_likes readable by auth" ON public.rental_comment_likes;
CREATE POLICY "rental_comment_likes readable by auth" ON public.rental_comment_likes
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.rental_comments c
    JOIN public.rental_listings r ON r.id = c.rental_id
    WHERE c.id = rental_comment_likes.comment_id
      AND (r.status = 'approved' OR r.user_id = auth.uid())
  )
);
