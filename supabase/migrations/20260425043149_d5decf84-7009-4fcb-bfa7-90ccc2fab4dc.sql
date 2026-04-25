DROP POLICY IF EXISTS "categories readable by all auth" ON public.categories;
CREATE POLICY "categories readable by everyone"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (true);