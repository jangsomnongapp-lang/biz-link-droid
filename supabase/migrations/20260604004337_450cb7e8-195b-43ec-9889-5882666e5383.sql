CREATE OR REPLACE FUNCTION public.generate_random_ticket_number(_ticket_type text, _draw_period_start date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _candidate integer;
  _exists boolean;
  _attempts integer := 0;
BEGIN
  LOOP
    _candidate := floor(random() * 900000 + 100000)::integer;
    _attempts := _attempts + 1;

    SELECT EXISTS (
      SELECT 1 FROM public.lottery_tickets
      WHERE ticket_type = _ticket_type
        AND draw_period_start = _draw_period_start
        AND ticket_number = _candidate
    ) INTO _exists;

    IF NOT _exists THEN
      RETURN _candidate;
    END IF;

    IF _attempts > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique random ticket number after 100 attempts';
    END IF;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_random_ticket_number(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_random_ticket_number(text, date) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_daily_availability(_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  today date := CURRENT_DATE;
  yesterday date := CURRENT_DATE - 1;
  existing record;
  new_streak int := 0;
  prev record;
  is_avail boolean;
  daily_ticket_id uuid;
  assigned_num int;
  week_start date;
  month_start date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('available','busy','available_soon') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  is_avail := _status IN ('available','available_soon');

  SELECT * INTO existing FROM public.daily_availability WHERE user_id = uid AND date = today;
  IF FOUND THEN
    SELECT ticket_number INTO assigned_num FROM public.lottery_tickets
      WHERE user_id = uid AND ticket_type = 'daily' AND draw_period_start = today
      LIMIT 1;
    RETURN jsonb_build_object('already', true, 'status', _status, 'ticket_number', assigned_num);
  END IF;

  INSERT INTO public.daily_availability (user_id, date, available, status)
  VALUES (uid, today, is_avail, _status);

  IF is_avail THEN
    assigned_num := public.generate_random_ticket_number('daily', today);

    INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source, ticket_number)
    VALUES (uid, 'daily', today, 'availability', assigned_num)
    RETURNING id INTO daily_ticket_id;

    week_start := current_week_start();
    INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source, ticket_number)
    VALUES (uid, 'weekly', week_start, 'availability', public.generate_random_ticket_number('weekly', week_start));

    SELECT * INTO prev FROM public.streak_tracker WHERE user_id = uid;
    IF NOT FOUND THEN
      INSERT INTO public.streak_tracker (user_id, current_streak, longest_streak, last_check_date)
      VALUES (uid, 1, 1, today);
      new_streak := 1;
    ELSE
      IF prev.last_check_date = yesterday THEN
        new_streak := prev.current_streak + 1;
      ELSE
        new_streak := 1;
      END IF;
      UPDATE public.streak_tracker
      SET current_streak = new_streak,
          longest_streak = GREATEST(prev.longest_streak, new_streak),
          last_check_date = today,
          updated_at = now()
      WHERE user_id = uid;
    END IF;

    IF new_streak > 0 AND new_streak % 7 = 0 THEN
      month_start := (current_month_start() + interval '1 month')::date;
      INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source, ticket_number)
      VALUES (uid, 'monthly', month_start, 'availability', public.generate_random_ticket_number('monthly', month_start));

      UPDATE public.streak_tracker
      SET current_streak = 0,
          updated_at = now()
      WHERE user_id = uid;
      new_streak := 0;
    END IF;
  ELSE
    INSERT INTO public.streak_tracker (user_id, current_streak, longest_streak, last_check_date)
    VALUES (uid, 0, 0, today)
    ON CONFLICT (user_id) DO UPDATE
      SET current_streak = 0, last_check_date = today, updated_at = now();
  END IF;

  RETURN jsonb_build_object('already', false, 'status', _status, 'ticket_number', assigned_num, 'streak', new_streak);
END;
$function$;

CREATE OR REPLACE FUNCTION public.issue_daily_ticket_if_missing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  _next_number := public.generate_random_ticket_number('daily', _today);

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
$function$;