
REVOKE EXECUTE ON FUNCTION public.mark_daily_availability(boolean) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.mark_daily_availability(boolean) TO authenticated;

ALTER FUNCTION public.current_week_start() SET search_path = public;
ALTER FUNCTION public.current_month_start() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.current_week_start() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_month_start() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.current_week_start() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_month_start() TO authenticated;
