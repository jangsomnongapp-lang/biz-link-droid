
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push_on_new_message failed: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.push_on_new_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    IF NEW.kind = 'message' THEN RETURN NEW; END IF;
    PERFORM public.dispatch_push_notification(
      NEW.user_id,
      COALESCE(NEW.title, 'BuildHub'),
      COALESCE(NEW.body, ''),
      jsonb_build_object(
        'kind', COALESCE(NEW.kind, ''),
        'notification_id', NEW.id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push_on_new_notification failed: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
