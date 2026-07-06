-- 1) daily_availability: drop broad read; add RPC for public "today status" only
DROP POLICY IF EXISTS "authenticated read all availability" ON public.daily_availability;

CREATE OR REPLACE FUNCTION public.get_today_availability(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status
  FROM public.daily_availability
  WHERE user_id = _uid AND date = CURRENT_DATE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_availability(uuid) TO authenticated, anon;

-- 2) messages: remove the permissive postgres_changes bypass policy
DROP POLICY IF EXISTS "authenticated postgres_changes only" ON public.messages;