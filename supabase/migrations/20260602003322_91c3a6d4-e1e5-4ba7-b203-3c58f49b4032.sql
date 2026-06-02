CREATE OR REPLACE FUNCTION public.run_lottery_draw(_draw_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  drw record;
  winning_ticket record;
  claim_id uuid;
  rewards_user uuid;
  thread_id uuid;
  a uuid; b uuid;
  post_id uuid;
  winner_name text;
  prize_label_en text;
  prize_label_km text;
  draw_label_km text;
  post_body text;
BEGIN
  IF NOT (public.is_admin(auth.uid())
          OR current_user IN ('postgres','supabase_admin')
          OR current_setting('role', true) = 'service_role') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO drw FROM public.lottery_draws WHERE id = _draw_id;
  IF drw IS NULL THEN RAISE EXCEPTION 'Draw not found'; END IF;
  IF drw.status = 'completed' THEN RAISE EXCEPTION 'Draw already completed'; END IF;

  SELECT t.* INTO winning_ticket
  FROM public.lottery_tickets t
  WHERE t.ticket_type = drw.draw_type
    AND t.draw_period_start <= drw.draw_date
    AND t.status = 'active'
  ORDER BY random()
  LIMIT 1;

  IF winning_ticket IS NULL THEN
    UPDATE public.lottery_draws SET status = 'no_entries', drawn_at = now() WHERE id = _draw_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'no_entries');
  END IF;

  UPDATE public.lottery_tickets SET status = 'won' WHERE id = winning_ticket.id;
  UPDATE public.lottery_tickets SET status = 'expired'
    WHERE ticket_type = drw.draw_type
      AND draw_period_start <= drw.draw_date
      AND status = 'active';

  INSERT INTO public.prize_claims (winner_id, draw_id, expires_at, status)
  VALUES (winning_ticket.user_id, drw.id, now() + interval '48 hours', 'pending')
  RETURNING id INTO claim_id;

  UPDATE public.lottery_draws
     SET status = 'drawn',
         drawn_at = now(),
         winner_user_id = winning_ticket.user_id,
         winning_ticket_id = winning_ticket.id
   WHERE id = drw.id;

  SELECT id INTO rewards_user FROM public.profiles
    WHERE is_super_user = true AND full_name ILIKE 'BuildHub Rewards' LIMIT 1;
  IF rewards_user IS NULL THEN
    SELECT id INTO rewards_user FROM public.profiles WHERE is_admin = true LIMIT 1;
  END IF;

  IF rewards_user IS NOT NULL AND rewards_user <> winning_ticket.user_id THEN
    IF rewards_user < winning_ticket.user_id THEN
      a := rewards_user; b := winning_ticket.user_id;
    ELSE
      a := winning_ticket.user_id; b := rewards_user;
    END IF;
    SELECT id INTO thread_id FROM public.message_threads
      WHERE participant_a = a AND participant_b = b LIMIT 1;
    IF thread_id IS NULL THEN
      INSERT INTO public.message_threads (participant_a, participant_b)
        VALUES (a, b) RETURNING id INTO thread_id;
    END IF;
    INSERT INTO public.messages (thread_id, sender_id, content)
    VALUES (thread_id, rewards_user,
      '🎉 Congratulations! You won the ' || drw.draw_type || ' draw: ' || drw.prize_title
      || E'\nClaim within 48 hours by replying here.');
  END IF;

  SELECT full_name INTO winner_name FROM public.profiles WHERE id = winning_ticket.user_id;

  prize_label_en := CASE drw.draw_type
    WHEN 'daily' THEN '$1 daily prize'
    WHEN 'weekly' THEN '$15 weekly prize'
    WHEN 'monthly' THEN '$40 monthly prize'
    ELSE drw.prize_title END;

  prize_label_km := CASE drw.draw_type
    WHEN 'daily' THEN 'រង្វាន់ $1 ប្រចាំថ្ងៃ'
    WHEN 'weekly' THEN 'រង្វាន់ $15 ប្រចាំសប្តាហ៍'
    WHEN 'monthly' THEN 'រង្វាន់ $40 ប្រចាំខែ'
    ELSE drw.prize_title END;

  draw_label_km := CASE drw.draw_type
    WHEN 'daily' THEN 'ប្រចាំថ្ងៃ'
    WHEN 'weekly' THEN 'ប្រចាំសប្តាហ៍'
    WHEN 'monthly' THEN 'ប្រចាំខែ'
    ELSE drw.draw_type END;

  post_body :=
    '🎉 Today''s ' || drw.draw_type || ' winner: ' || COALESCE(winner_name, 'Member')
    || ' won ' || prize_label_en || '!'
    || E'\n\n'
    || '🎉 អ្នកឈ្នះរង្វាន់' || draw_label_km || 'ថ្ងៃនេះគឺ ' || COALESCE(winner_name, 'សមាជិក')
    || ' បានឈ្នះ' || prize_label_km || '។';

  IF rewards_user IS NOT NULL THEN
    INSERT INTO public.posts (user_id, content, status)
    VALUES (rewards_user, post_body, 'approved')
    RETURNING id INTO post_id;
    UPDATE public.lottery_draws SET published_at = now() WHERE id = drw.id;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_post_id)
  VALUES (winning_ticket.user_id, 'lottery_win',
    '🎉 You won the ' || drw.draw_type || ' draw!',
    'Claim within 48 hours · ' || drw.prize_title,
    rewards_user, post_id);

  RETURN jsonb_build_object('ok', true, 'winner_id', winning_ticket.user_id,
    'ticket_number', winning_ticket.ticket_number, 'claim_id', claim_id, 'post_id', post_id);
END; $function$;