CREATE TABLE public.telegram_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone_digits text NOT NULL,
  start_token_hash text NOT NULL UNIQUE,
  code_hash text,
  telegram_chat_id bigint,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_password_resets TO service_role;

ALTER TABLE public.telegram_password_resets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages Telegram password resets"
ON public.telegram_password_resets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX telegram_password_resets_user_created_idx
ON public.telegram_password_resets (user_id, created_at DESC);

CREATE INDEX telegram_password_resets_phone_created_idx
ON public.telegram_password_resets (phone_digits, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_telegram_password_reset_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_telegram_password_resets_updated_at
BEFORE UPDATE ON public.telegram_password_resets
FOR EACH ROW
EXECUTE FUNCTION public.set_telegram_password_reset_updated_at();