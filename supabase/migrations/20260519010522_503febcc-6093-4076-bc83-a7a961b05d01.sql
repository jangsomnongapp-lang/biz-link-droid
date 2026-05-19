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
  next_num int;
  daily_ticket_id uuid;
  assigned_num int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('available','busy','available_soon') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  is_avail := _status IN ('available','available_soon');

  SELECT * INTO existing FROM public.daily_availability WHERE user_id = uid AND date = today;
  IF FOUND THEN
    UPDATE public.daily_availability SET status = _status, available = is_avail WHERE id = existing.id;
    SELECT ticket_number INTO assigned_num FROM public.lottery_tickets
      WHERE user_id = uid AND ticket_type = 'daily' AND draw_period_start = today
      LIMIT 1;
    RETURN jsonb_build_object('already', true, 'status', _status, 'ticket_number', assigned_num);
  END IF;

  INSERT INTO public.daily_availability (user_id, date, available, status)
  VALUES (uid, today, is_avail, _status);

  IF is_avail THEN
    SELECT COALESCE(MAX(ticket_number), 999) + 1 INTO next_num
      FROM public.lottery_tickets
      WHERE ticket_type = 'daily' AND draw_period_start = today;

    INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source, ticket_number)
    VALUES (uid, 'daily', today, 'availability', next_num)
    RETURNING id, ticket_number INTO daily_ticket_id, assigned_num;

    INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source)
    VALUES (uid, 'weekly', current_week_start(), 'availability');

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

    -- Monthly ticket: only awarded once every 7-day streak milestone
    IF new_streak > 0 AND new_streak % 7 = 0 THEN
      INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source)
      VALUES (uid, 'monthly', (current_month_start() + interval '1 month')::date, 'availability');
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