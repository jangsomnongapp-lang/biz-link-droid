
-- email_send_log: explicit RESTRICTIVE deny for authenticated and anon
DROP POLICY IF EXISTS "deny_non_service_role" ON public.email_send_log;
CREATE POLICY "deny_non_service_role" ON public.email_send_log
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- email_unsubscribe_tokens: explicit RESTRICTIVE deny for authenticated and anon
DROP POLICY IF EXISTS "deny_non_service_role" ON public.email_unsubscribe_tokens;
CREATE POLICY "deny_non_service_role" ON public.email_unsubscribe_tokens
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- suppressed_emails: explicit anon deny (already has authenticated deny)
DROP POLICY IF EXISTS "deny anon read" ON public.suppressed_emails;
CREATE POLICY "deny anon read" ON public.suppressed_emails
  AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);
