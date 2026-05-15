-- Allow users to update and delete their own daily_availability records
CREATE POLICY "Users update own availability"
ON public.daily_availability
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own availability"
ON public.daily_availability
FOR DELETE
USING (auth.uid() = user_id);