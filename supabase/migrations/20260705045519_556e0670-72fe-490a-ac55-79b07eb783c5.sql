
CREATE POLICY "authenticated read all availability"
  ON public.daily_availability FOR SELECT
  TO authenticated
  USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_availability;
