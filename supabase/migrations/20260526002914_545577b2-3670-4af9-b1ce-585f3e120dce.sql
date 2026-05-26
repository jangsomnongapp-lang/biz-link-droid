DROP POLICY IF EXISTS "Users delete own availability" ON public.daily_availability;
DROP POLICY IF EXISTS "Users update own availability" ON public.daily_availability;

CREATE POLICY "Users delete own availability"
ON public.daily_availability
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users update own availability"
ON public.daily_availability
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);