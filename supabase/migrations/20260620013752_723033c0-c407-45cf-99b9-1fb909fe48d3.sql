
CREATE POLICY "Deny anon and authenticated on password_reset_codes"
ON public.password_reset_codes
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny anon and authenticated on telegram_password_resets"
ON public.telegram_password_resets
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
