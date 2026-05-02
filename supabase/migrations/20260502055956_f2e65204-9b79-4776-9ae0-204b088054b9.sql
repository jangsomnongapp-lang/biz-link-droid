-- Enable pg_net for outbound HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Settings table (admin-only) holding the webhook URL, chat id and shared secret
CREATE TABLE IF NOT EXISTS public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  telegram_chat_id text,
  telegram_webhook_url text,
  telegram_webhook_secret text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings"
  ON public.app_settings FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Generic notify function: posts a JSON payload to the configured webhook
CREATE OR REPLACE FUNCTION public.notify_telegram(_kind text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _url text;
  _secret text;
  _chat text;
BEGIN
  SELECT telegram_webhook_url, telegram_webhook_secret, telegram_chat_id
    INTO _url, _secret, _chat
  FROM public.app_settings WHERE id = 1;

  IF _url IS NULL OR _chat IS NULL OR _secret IS NULL THEN
    RETURN; -- not configured yet, silently skip
  END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', _secret
    ),
    body := jsonb_build_object(
      'kind', _kind,
      'chat_id', _chat,
      'data', _payload
    )
  );
END;
$$;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.tg_notify_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name text;
BEGIN
  SELECT full_name INTO _name FROM public.profiles WHERE id = NEW.reporter_id;
  PERFORM public.notify_telegram('report', jsonb_build_object(
    'id', NEW.id,
    'reporter_id', NEW.reporter_id,
    'reporter_name', COALESCE(_name, 'Someone'),
    'target_kind', NEW.target_kind,
    'target_id', NEW.target_id,
    'reason', NEW.reason
  ));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_notify_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name text;
BEGIN
  SELECT full_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify_telegram('post', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'user_name', COALESCE(_name, 'Someone'),
    'content', NEW.content,
    'status', NEW.status
  ));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_notify_new_story()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name text;
BEGIN
  SELECT full_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify_telegram('story', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'user_name', COALESCE(_name, 'Someone'),
    'caption', NEW.caption,
    'status', NEW.status
  ));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_notify_new_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name text;
BEGIN
  SELECT full_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify_telegram('project', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'user_name', COALESCE(_name, 'Someone'),
    'title', NEW.title,
    'status', NEW.status
  ));
  RETURN NEW;
END;
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_notify_new_report ON public.reports;
CREATE TRIGGER trg_notify_new_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_report();

DROP TRIGGER IF EXISTS trg_notify_new_post ON public.posts;
CREATE TRIGGER trg_notify_new_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_post();

DROP TRIGGER IF EXISTS trg_notify_new_story ON public.stories;
CREATE TRIGGER trg_notify_new_story
  AFTER INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_story();

DROP TRIGGER IF EXISTS trg_notify_new_listing ON public.listings;
CREATE TRIGGER trg_notify_new_listing
  AFTER INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_listing();