
CREATE TABLE public.rental_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id uuid NOT NULL REFERENCES public.rental_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rental_id, user_id)
);
CREATE INDEX idx_rental_likes_rental ON public.rental_likes(rental_id);
ALTER TABLE public.rental_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rental_likes readable by auth" ON public.rental_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own rental_likes" ON public.rental_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own rental_likes" ON public.rental_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.rental_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id uuid NOT NULL REFERENCES public.rental_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.rental_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rental_comments_rental ON public.rental_comments(rental_id);
CREATE INDEX idx_rental_comments_parent ON public.rental_comments(parent_id);
ALTER TABLE public.rental_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rental_comments readable by auth" ON public.rental_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own rental_comments" ON public.rental_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own rental_comments" ON public.rental_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE TABLE public.rental_comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.rental_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.rental_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rental_comment_likes readable by auth" ON public.rental_comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own rental_comment_likes" ON public.rental_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own rental_comment_likes" ON public.rental_comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
