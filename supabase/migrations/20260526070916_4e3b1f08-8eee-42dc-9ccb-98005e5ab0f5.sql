DROP POLICY IF EXISTS "approved or own listings readable" ON public.listings;

CREATE POLICY "active or own listings readable"
ON public.listings
FOR SELECT
TO authenticated
USING (
  status IN ('active', 'approved')
  OR auth.uid() = user_id
  OR is_admin(auth.uid())
);