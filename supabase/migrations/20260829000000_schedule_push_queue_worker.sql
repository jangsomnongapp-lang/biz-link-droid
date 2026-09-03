-- Schedule the push notification queue worker via pg_cron.
-- The worker (process-push-queue) polls push_notification_queue and sends
-- pending rows via Expo/FCM. Without this cron job, the queue is never
-- processed and push notifications are never delivered.

-- 1. Store the queue worker secret in vault (used to authenticate the call).
DO $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM vault.secrets WHERE name = 'queue_worker_secret';
  IF _id IS NULL THEN
    PERFORM vault.create_secret('266d70e479711aa45f1a8f89ba36478102b733d5b0a80fd8f532fbcbf94e8cfe', 'queue_worker_secret');
  ELSE
    PERFORM vault.update_secret(_id, '266d70e479711aa45f1a8f89ba36478102b733d5b0a80fd8f532fbcbf94e8cfe');
  END IF;
END $$;

-- 2. Function that calls the queue worker endpoint.
CREATE OR REPLACE FUNCTION public.run_push_queue_worker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
    WHERE name = 'queue_worker_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _key := NULL;
  END;

  IF _key IS NULL THEN
    RAISE WARNING 'run_push_queue_worker: queue_worker_secret not available';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://buildhubkh.com/api/public/process-push-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body := '{}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'run_push_queue_worker failed: %', SQLERRM;
END;
$function$;

-- 3. Schedule the worker every minute.
SELECT cron.schedule('push-queue-worker', '* * * * *', $$SELECT public.run_push_queue_worker();$$);
