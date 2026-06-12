CREATE POLICY "Service role only access" ON public.password_reset_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.password_reset_codes FROM anon, authenticated;
GRANT ALL ON public.password_reset_codes TO service_role;