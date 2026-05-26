-- Issue today's daily lottery ticket to any worker (provider/specialist) who doesn't have one,
-- regardless of availability status. Idempotent.
CREATE OR REPLACE FUNCTION public.issue_daily_ticket_if_missing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := CURRENT_DATE;
  _is_worker boolean;
  _existing_number int;
  _next_number int;
  _streak int := 1;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (COALESCE(is_provider, false) OR COALESCE(is_specialist, false))
    INTO _is_worker
  FROM public.profiles
  WHERE id = _user;

  IF NOT COALESCE(_is_worker, false) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_worker');
  END IF;

  -- Already has today's daily ticket?
  SELECT ticket_number INTO _existing_number
  FROM public.lottery_tickets
  WHERE user_id = _user
    AND ticket_type = 'daily'
    AND draw_period_start = _today
  LIMIT 1;

  IF _existing_number IS NOT NULL THEN
    RETURN jsonb_build_object('already', true, 'ticket_number', _existing_number);
  END IF;

  -- Compute next ticket number for today
  SELECT COALESCE(MAX(ticket_number), 999) + 1
    INTO _next_number
  FROM public.lottery_tickets
  WHERE ticket_type = 'daily' AND draw_period_start = _today;

  INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, ticket_number, source, status)
  VALUES (_user, 'daily', _today, _next_number, 'auto_open', 'active');

  -- Compute simple streak from prior consecutive daily tickets
  WITH consecutive AS (
    SELECT draw_period_start,
           ROW_NUMBER() OVER (ORDER BY draw_period_start DESC) AS rn
    FROM public.lottery_tickets
    WHERE user_id = _user AND ticket_type = 'daily'
  )
  SELECT COUNT(*) INTO _streak
  FROM consecutive
  WHERE draw_period_start = _today - (rn - 1);

  RETURN jsonb_build_object('ticket_number', _next_number, 'streak', COALESCE(_streak, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_daily_ticket_if_missing() TO authenticated;