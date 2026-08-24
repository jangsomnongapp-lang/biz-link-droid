ALTER TABLE public.device_tokens ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'unknown';

CREATE TABLE IF NOT EXISTS public.push_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL,
  platform text,
  title text NOT NULL,
  body text,
  data jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notification_queue TO authenticated;
GRANT ALL ON public.push_notification_queue TO service_role;

ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage push queue"
  ON public.push_notification_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert their own push jobs"
  ON public.push_notification_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (true);