
-- Helper: security-definer function to check admin status without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _uid AND is_admin = true
  );
$$;

-- Track rejection time on posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Admin policies on posts
DROP POLICY IF EXISTS "admins manage all posts update" ON public.posts;
CREATE POLICY "admins manage all posts update"
ON public.posts
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins delete posts" ON public.posts;
CREATE POLICY "admins delete posts"
ON public.posts
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admins can read all posts (including pending) for moderation
DROP POLICY IF EXISTS "admins read all posts" ON public.posts;
CREATE POLICY "admins read all posts"
ON public.posts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin policies on listings
DROP POLICY IF EXISTS "admins update listings" ON public.listings;
CREATE POLICY "admins update listings"
ON public.listings
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins delete listings" ON public.listings;
CREATE POLICY "admins delete listings"
ON public.listings
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
