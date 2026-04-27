
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('pending', 'active', 'rejected', 'closed', 'finished'));
