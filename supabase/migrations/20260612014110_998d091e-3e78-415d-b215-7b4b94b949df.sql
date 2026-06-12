
-- Allow authors to delete their own posts
CREATE POLICY "users delete own posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authors to edit their own comments
CREATE POLICY "users update own post_comments"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own rental_comments"
  ON public.rental_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow store owners to delete their own supplier store
CREATE POLICY "owner deletes own store"
  ON public.supplier_stores FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins delete supplier stores"
  ON public.supplier_stores FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
