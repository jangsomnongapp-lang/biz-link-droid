-- Add provider column to device_tokens for token routing (fcm vs expo)
-- and backfill existing rows based on token format

ALTER TABLE public.device_tokens
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'unknown';

-- Backfill: Expo tokens contain 'ExponentPushToken'
UPDATE public.device_tokens
SET provider = 'expo'
WHERE provider = 'unknown'
  AND token ILIKE '%ExponentPushToken%';

-- Backfill: everything else as fcm (covers native Capacitor builds)
UPDATE public.device_tokens
SET provider = 'fcm'
WHERE provider = 'unknown';
