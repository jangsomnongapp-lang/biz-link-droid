-- Push notification triggers for mobile app
-- Sends push notifications via Expo when new messages/notifications are created

-- Function: send push notification via Expo API
CREATE OR REPLACE FUNCTION public.send_push_notification(
  _user_id uuid,
  _title text,
  _body text,
  _data jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
  _platform text;
BEGIN
  -- Get user's device tokens
  FOR _token, _platform IN
    SELECT token, platform FROM public.device_tokens
    WHERE user_id = _user_id
  LOOP
    -- Queue push notification (will be sent by backend worker)
    INSERT INTO public.push_notification_queue (
      device_token,
      platform,
      title,
      body,
      data,
      status
    ) VALUES (
      _token,
      _platform,
      _title,
      _body,
      _data,
      'pending'
    );
  END LOOP;
END;
$$;

-- Table: push notification queue (processed by backend worker)
CREATE TABLE IF NOT EXISTS public.push_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL,
  platform text,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX push_queue_status_created_idx ON public.push_notification_queue (status, created_at);

ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage queue
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notification_queue TO service_role;

-- Trigger: notify on new message
CREATE OR REPLACE FUNCTION public.tg_notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_name text;
  _recipient_id uuid;
  _thread_title text;
BEGIN
  -- Get recipient (the other participant in thread)
  SELECT 
    CASE 
      WHEN t.participant_a = NEW.sender_id THEN t.participant_b
      ELSE t.participant_a
    END,
    COALESCE(p.full_name, 'Someone'),
    COALESCE(t.listing_id::text, 'Chat')
  INTO _recipient_id, _sender_name, _thread_title
  FROM public.message_threads t
  LEFT JOIN public.profiles p ON p.id = NEW.sender_id
  WHERE t.id = NEW.thread_id;

  -- Send push to recipient
  IF _recipient_id IS NOT NULL THEN
    PERFORM public.send_push_notification(
      _recipient_id,
      _sender_name,
      NEW.content,
      jsonb_build_object(
        'type', 'message',
        'thread_id', NEW.thread_id,
        'sender_id', NEW.sender_id,
        'url', '/messages/' || NEW.thread_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists and create trigger
DROP TRIGGER IF EXISTS trg_push_notify_message ON public.messages;
CREATE TRIGGER trg_push_notify_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_new_message();

-- Trigger: notify on new notification (likes, comments, follows, etc.)
CREATE OR REPLACE FUNCTION public.tg_notify_new_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
BEGIN
  -- Build URL based on notification kind
  _url := CASE NEW.kind
    WHEN 'like_post' THEN '/post/' || COALESCE(NEW.related_listing_id::text, '')
    WHEN 'like_comment' THEN '/post/' || COALESCE(NEW.related_listing_id::text, '')
    WHEN 'comment' THEN '/post/' || COALESCE(NEW.related_listing_id::text, '')
    WHEN 'reply' THEN '/post/' || COALESCE(NEW.related_listing_id::text, '')
    WHEN 'follow' THEN '/profile/' || COALESCE(NEW.related_user_id::text, '')
    WHEN 'message' THEN '/messages'
    WHEN 'project_invite' THEN '/projects'
    WHEN 'project_update' THEN '/projects'
    ELSE '/notifications'
  END;

  -- Send push notification
  PERFORM public.send_push_notification(
    NEW.user_id,
    NEW.title,
    COALESCE(NEW.body, ''),
    jsonb_build_object(
      'type', NEW.kind,
      'notification_id', NEW.id,
      'related_user_id', NEW.related_user_id,
      'related_listing_id', NEW.related_listing_id,
      'url', _url
    )
  );

  RETURN NEW;
END;
$$;

-- Drop if exists and create trigger
DROP TRIGGER IF EXISTS trg_push_notify_notification ON public.notifications;
CREATE TRIGGER trg_push_notify_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_new_notification();

-- Cleanup old processed notifications daily
CREATE OR REPLACE FUNCTION public.cleanup_push_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.push_notification_queue
  WHERE status = 'sent' 
    AND created_at < now() - interval '7 days';
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.send_push_notification(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_push_queue() TO service_role;
