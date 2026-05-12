-- Hide telegram webhook secret from client roles. The notify_telegram() function
-- is SECURITY DEFINER and runs as the table owner, so the trigger pipeline keeps working.
REVOKE SELECT (telegram_webhook_secret) ON public.app_settings FROM anon, authenticated;