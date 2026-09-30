CREATE OR REPLACE FUNCTION public.get_recent_draw_results()
RETURNS TABLE (draw_id uuid, draw_type text, draw_date date, prize_title text, winner_name text, ticket_number integer, drawn_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.draw_type, d.draw_date::date, d.prize_title, p.full_name, t.ticket_number::int, d.drawn_at
  FROM public.lottery_draws d
  LEFT JOIN public.profiles p ON p.id = d.winner_user_id
  LEFT JOIN public.lottery_tickets t ON t.id = d.winning_ticket_id
  WHERE d.status = 'drawn' AND d.draw_date >= CURRENT_DATE - 7
  ORDER BY d.draw_date DESC, d.draw_type;
$$;
GRANT EXECUTE ON FUNCTION public.get_recent_draw_results() TO authenticated;