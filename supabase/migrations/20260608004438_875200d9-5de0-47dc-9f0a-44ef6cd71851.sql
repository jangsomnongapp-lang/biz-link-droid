
-- Product posts: type, optional title, optional price
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS price numeric(12,2);

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_post_type_check
  CHECK (post_type IN ('general','novedad','stock','oferta','liquidacion'));

-- Pinned product on a chat thread
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS pinned_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

-- RPC: start (or find) a chat thread with a supplier and pin a product
CREATE OR REPLACE FUNCTION public.start_product_chat(_supplier_id uuid, _post_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  a uuid;
  b uuid;
  thread_id uuid;
  post_owner uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF caller = _supplier_id THEN RAISE EXCEPTION 'Cannot chat with self'; END IF;

  -- Validate the post belongs to the supplier (when provided)
  IF _post_id IS NOT NULL THEN
    SELECT user_id INTO post_owner FROM public.posts WHERE id = _post_id;
    IF post_owner IS NULL OR post_owner <> _supplier_id THEN
      _post_id := NULL;
    END IF;
  END IF;

  IF caller < _supplier_id THEN a := caller; b := _supplier_id;
  ELSE a := _supplier_id; b := caller;
  END IF;

  SELECT id INTO thread_id FROM public.message_threads
    WHERE participant_a = a AND participant_b = b LIMIT 1;

  IF thread_id IS NULL THEN
    INSERT INTO public.message_threads (participant_a, participant_b, pinned_post_id)
    VALUES (a, b, _post_id) RETURNING id INTO thread_id;
  ELSIF _post_id IS NOT NULL THEN
    UPDATE public.message_threads SET pinned_post_id = _post_id WHERE id = thread_id;
  END IF;

  RETURN thread_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.start_product_chat(uuid, uuid) TO authenticated;
