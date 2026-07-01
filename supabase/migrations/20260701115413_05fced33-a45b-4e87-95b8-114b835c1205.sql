
CREATE OR REPLACE FUNCTION public.dispatch_push_notification(
  _user_id uuid,
  _title text,
  _body text,
  _data jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  _key text;
BEGIN
  IF _user_id IS NULL OR _title IS NULL THEN RETURN; END IF;

  BEGIN
    SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _key := NULL;
  END;

  IF _key IS NULL THEN
    RAISE WARNING 'dispatch_push_notification: service role key not available';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://project--257d13d8-9587-4c64-8336-982de107664d.lovable.app/api/public/fcm-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body := jsonb_build_object(
      'user_id', _user_id,
      'title', _title,
      'body', COALESCE(_body, ''),
      'data', COALESCE(_data, '{}'::jsonb)
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_push_notification failed: %', SQLERRM;
END;
$$;

-- Push on new chat message
CREATE OR REPLACE FUNCTION public.push_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipient uuid;
  _sender_name text;
  _preview text;
BEGIN
  SELECT CASE WHEN t.participant_a = NEW.sender_id THEN t.participant_b ELSE t.participant_a END
    INTO _recipient
  FROM public.message_threads t
  WHERE t.id = NEW.thread_id;

  IF _recipient IS NULL OR _recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  _preview := LEFT(COALESCE(NEW.content, ''), 140);

  PERFORM public.dispatch_push_notification(
    _recipient,
    COALESCE(_sender_name, 'New message'),
    _preview,
    jsonb_build_object(
      'kind', 'message',
      'thread_id', NEW.thread_id::text,
      'sender_id', NEW.sender_id::text
    )
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_push_on_new_message ON public.messages;
CREATE TRIGGER trg_push_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.push_on_new_message();

-- Push on new in-app notification (likes, comments, applications, project events, etc.)
CREATE OR REPLACE FUNCTION public.push_on_new_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.kind = 'message' THEN
    RETURN NEW; -- handled by push_on_new_message
  END IF;

  PERFORM public.dispatch_push_notification(
    NEW.user_id,
    COALESCE(NEW.title, 'BuildHub'),
    COALESCE(NEW.body, ''),
    jsonb_build_object(
      'kind', COALESCE(NEW.kind, ''),
      'notification_id', NEW.id::text,
      'related_user_id', COALESCE(NEW.related_user_id::text, ''),
      'related_post_id', COALESCE(NEW.related_post_id::text, ''),
      'related_listing_id', COALESCE(NEW.related_listing_id::text, ''),
      'related_project_id', COALESCE(NEW.related_project_id::text, '')
    )
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_push_on_new_notification ON public.notifications;
CREATE TRIGGER trg_push_on_new_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.push_on_new_notification();
