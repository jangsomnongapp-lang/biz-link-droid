
-- Default new listings to pending review
ALTER TABLE public.listings ALTER COLUMN status SET DEFAULT 'pending';

-- Track rejection timestamp like posts/stories
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Admin policies on listings (idempotent)
DROP POLICY IF EXISTS "Admins can view all listings" ON public.listings;
CREATE POLICY "Admins can view all listings"
ON public.listings
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update any listing" ON public.listings;
CREATE POLICY "Admins can update any listing"
ON public.listings
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete any listing" ON public.listings;
CREATE POLICY "Admins can delete any listing"
ON public.listings
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
