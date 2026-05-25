-- 1. Restrict column-level SELECT on phone for profiles and supplier_stores.
--    Owners still read their own phone via the dedicated RPCs
--    (get_user_phone / get_supplier_store_phone), which run as SECURITY DEFINER.
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (phone) ON public.supplier_stores FROM anon, authenticated;

-- 2. Pin search_path on pgmq helper functions to silence the linter and
--    guarantee pgmq resolution regardless of caller's search_path.
ALTER FUNCTION public.enqueue_email(text, jsonb)      SET search_path = pgmq, public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = pgmq, public;
ALTER FUNCTION public.delete_email(text, bigint)      SET search_path = pgmq, public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = pgmq, public;