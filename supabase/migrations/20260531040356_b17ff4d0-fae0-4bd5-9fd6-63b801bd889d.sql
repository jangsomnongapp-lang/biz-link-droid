CREATE OR REPLACE FUNCTION public.auto_run_due_draws()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d record;
  ran int := 0;
BEGIN
  IF NOT (current_user IN ('postgres','supabase_admin')
          OR current_setting('role', true) = 'service_role'
          OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.ensure_scheduled_draws();

  FOR d IN
    SELECT id FROM public.lottery_draws
    WHERE status = 'scheduled' AND draw_date <= CURRENT_DATE
    ORDER BY draw_date ASC
  LOOP
    PERFORM public.run_lottery_draw(d.id);
    ran := ran + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ran', ran);
END; $$;