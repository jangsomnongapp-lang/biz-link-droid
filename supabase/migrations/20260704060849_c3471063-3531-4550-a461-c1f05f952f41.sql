-- Allow users to manage their own FCM device tokens so push notifications can be delivered.
CREATE POLICY "Users can view own device tokens" ON public.device_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device tokens" ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device tokens" ON public.device_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own device tokens" ON public.device_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);