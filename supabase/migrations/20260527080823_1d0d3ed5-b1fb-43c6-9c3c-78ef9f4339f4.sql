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

  -- Serialize daily ticket numbering/checking so mobile app resumes and
  -- multiple tabs cannot race each other.
  PERFORM pg_advisory_xact_lock(hashtext('daily-ticket:' || _today::text));

  SELECT ticket_number INTO _existing_number
  FROM public.lottery_tickets
  WHERE user_id = _user
    AND ticket_type = 'daily'
    AND draw_period_start = _today
  ORDER BY created_at ASC
  LIMIT 1;

  IF _existing_number IS NOT NULL THEN
    RETURN jsonb_build_object('already', true, 'ticket_number', _existing_number);
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
  WHERE draw_period_start = _today - (rn - 1);

  RETURN jsonb_build_object('ticket_number', _next_number, 'streak', COALESCE(_streak, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_daily_ticket_if_missing() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_daily_availability(_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := CURRENT_DATE;
  yesterday date := CURRENT_DATE - 1;
  existing record;
  new_streak int := 0;
  prev record;
  is_avail boolean;
  next_num int;
  assigned_num int;
  has_daily_ticket boolean;
  has_weekly_today boolean;
  was_already_today boolean := false;
  streak_advanced boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('available','busy','available_soon') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  is_avail := _status IN ('available','available_soon');

  -- One availability decision per user/day should be processed at a time.
  PERFORM pg_advisory_xact_lock(hashtext('availability:' || uid::text || ':' || today::text));

  SELECT * INTO existing FROM public.daily_availability WHERE user_id = uid AND date = today;
  IF FOUND THEN
    was_already_today := true;
    UPDATE public.daily_availability SET status = _status, available = is_avail WHERE id = existing.id;
  ELSE
    INSERT INTO public.daily_availability (user_id, date, available, status)
    VALUES (uid, today, is_avail, _status);
  END IF;

  IF is_avail THEN
    SELECT EXISTS (
      SELECT 1 FROM public.lottery_tickets
      WHERE user_id = uid AND ticket_type = 'daily' AND draw_period_start = today
    ) INTO has_daily_ticket;

    IF has_daily_ticket THEN
      SELECT ticket_number INTO assigned_num FROM public.lottery_tickets
        WHERE user_id = uid AND ticket_type = 'daily' AND draw_period_start = today
        ORDER BY created_at ASC
        LIMIT 1;
    ELSE
      PERFORM pg_advisory_xact_lock(hashtext('daily-ticket:' || today::text));

      SELECT COALESCE(MAX(ticket_number), 999) + 1 INTO next_num
        FROM public.lottery_tickets
        WHERE ticket_type = 'daily' AND draw_period_start = today;

      INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source, ticket_number)
      VALUES (uid, 'daily', today, 'availability', next_num)
      RETURNING ticket_number INTO assigned_num;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.lottery_tickets
      WHERE user_id = uid
        AND ticket_type = 'weekly'
        AND draw_period_start = current_week_start()
        AND source = 'availability'
        AND created_at::date = today
    ) INTO has_weekly_today;

    IF NOT has_weekly_today THEN
      INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source)
      VALUES (uid, 'weekly', current_week_start(), 'availability');
    END IF;

    SELECT * INTO prev FROM public.streak_tracker WHERE user_id = uid;
    IF NOT FOUND THEN
      INSERT INTO public.streak_tracker (user_id, current_streak, longest_streak, last_check_date)
      VALUES (uid, 1, 1, today);
      new_streak := 1;
      streak_advanced := true;
    ELSE
      IF prev.last_check_date = today AND prev.current_streak > 0 THEN
        new_streak := prev.current_streak;
      ELSIF prev.last_check_date = yesterday THEN
        new_streak := prev.current_streak + 1;
        streak_advanced := true;
      ELSE
        new_streak := 1;
        streak_advanced := true;
      END IF;

      UPDATE public.streak_tracker
      SET current_streak = new_streak,
          longest_streak = GREATEST(prev.longest_streak, new_streak),
          last_check_date = today,
          updated_at = now()
      WHERE user_id = uid;
    END IF;

    IF streak_advanced AND new_streak > 0 AND new_streak % 7 = 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.lottery_tickets
        WHERE user_id = uid
          AND ticket_type = 'monthly'
          AND draw_period_start = (current_month_start() + interval '1 month')::date
          AND source = 'availability'
          AND created_at::date = today
      ) THEN
        INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source)
        VALUES (uid, 'monthly', (current_month_start() + interval '1 month')::date, 'availability');
      END IF;

      UPDATE public.streak_tracker
      SET current_streak = 0, updated_at = now()
      WHERE user_id = uid;
      new_streak := 0;
    END IF;
  ELSE
    INSERT INTO public.streak_tracker (user_id, current_streak, longest_streak, last_check_date)
    VALUES (uid, 0, 0, today)
    ON CONFLICT (user_id) DO UPDATE
      SET current_streak = 0, last_check_date = today, updated_at = now();
  END IF;

  RETURN jsonb_build_object('already', was_already_today, 'status', _status, 'ticket_number', assigned_num, 'streak', new_streak);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_daily_availability(text) TO authenticated;