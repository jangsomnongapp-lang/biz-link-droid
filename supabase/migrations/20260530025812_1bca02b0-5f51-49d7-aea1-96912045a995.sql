CREATE OR REPLACE FUNCTION public.issue_daily_ticket_if_missing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := CURRENT_DATE;
  _existing_number int;
  _next_number int;
  _streak int := 1;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('daily-ticket:' || _today::text));

  SELECT ticket_number INTO _existing_number
  FROM public.lottery_tickets
  WHERE user_id = _user
    AND ticket_type = 'daily'
    AND draw_period_start = _today
  ORDER BY created_at ASC
  LIMIT 1;

  IF _existing_number IS NOT NULL THEN
    WITH consecutive AS (
      SELECT draw_period_start,
             ROW_NUMBER() OVER (ORDER BY draw_period_start DESC) AS rn
      FROM public.lottery_tickets
      WHERE user_id = _user AND ticket_type = 'daily'
      GROUP BY draw_period_start
    )
    SELECT COUNT(*) INTO _streak
    FROM consecutive
    WHERE draw_period_start = _today - ((rn - 1)::int);

    RETURN jsonb_build_object('already', true, 'ticket_number', _existing_number, 'streak', COALESCE(_streak, 1));
  END IF;

  SELECT COALESCE(MAX(ticket_number), 999) + 1
    INTO _next_number
  FROM public.lottery_tickets
  WHERE ticket_type = 'daily' AND draw_period_start = _today;

  INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, ticket_number, source, status)
  VALUES (_user, 'daily', _today, _next_number, 'auto_open', 'active');

  WITH consecutive AS (
    SELECT draw_period_start,
           ROW_NUMBER() OVER (ORDER BY draw_period_start DESC) AS rn
    FROM public.lottery_tickets
    WHERE user_id = _user AND ticket_type = 'daily'
    GROUP BY draw_period_start
  )
  SELECT COUNT(*) INTO _streak
  FROM consecutive
  WHERE draw_period_start = _today - ((rn - 1)::int);

  RETURN jsonb_build_object('ticket_number', _next_number, 'streak', COALESCE(_streak, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_daily_ticket_if_missing() TO authenticated;