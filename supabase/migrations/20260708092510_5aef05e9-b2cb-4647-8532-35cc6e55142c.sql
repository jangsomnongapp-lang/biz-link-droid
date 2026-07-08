
-- Store shared FCM push webhook secret in vault and update dispatch to use it
DO $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM vault.secrets WHERE name = 'fcm_push_webhook_secret';
  IF _id IS NULL THEN
    PERFORM vault.create_secret('2ad78ff97b605227be26b70140f82ec9518dd424ba538407db7a9ec458bf6a0a', 'fcm_push_webhook_secret');
  ELSE
    PERFORM vault.update_secret(_id, '2ad78ff97b605227be26b70140f82ec9518dd424ba538407db7a9ec458bf6a0a');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.dispatch_push_notification(_user_id uuid, _title text, _body text, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _key text;
BEGIN
  IF _user_id IS NULL OR _title IS NULL THEN RETURN; END IF;

  BEGIN
    SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
    WHERE name = 'fcm_push_webhook_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _key := NULL;
  END;

  IF _key IS NULL THEN
    RAISE WARNING 'dispatch_push_notification: fcm_push_webhook_secret not available';
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
$function$;
