
-- 1. daily_availability
CREATE TABLE public.daily_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  available boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE public.daily_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own availability" ON public.daily_availability
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own availability" ON public.daily_availability
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all availability" ON public.daily_availability
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 2. lottery_tickets
CREATE TABLE public.lottery_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticket_type text NOT NULL CHECK (ticket_type IN ('daily','weekly','monthly')),
  draw_period_start date NOT NULL,
  source text NOT NULL DEFAULT 'availability',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','won')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lottery_tickets_period ON public.lottery_tickets(ticket_type, draw_period_start, status);
CREATE INDEX idx_lottery_tickets_user ON public.lottery_tickets(user_id, status);
CREATE POLICY "users read own tickets" ON public.lottery_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all tickets" ON public.lottery_tickets
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage tickets" ON public.lottery_tickets
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 3. streak_tracker
CREATE TABLE public.streak_tracker (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_check_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own streak" ON public.streak_tracker
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage streak" ON public.streak_tracker
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 4. lottery_draws
CREATE TABLE public.lottery_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_type text NOT NULL CHECK (draw_type IN ('daily','weekly','monthly')),
  draw_date date NOT NULL,
  prize_title text NOT NULL,
  prize_description text,
  prize_image_url text,
  winner_user_id uuid,
  winning_ticket_id uuid REFERENCES public.lottery_tickets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','drawn','published')),
  drawn_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draw_type, draw_date)
);
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read draws" ON public.lottery_draws
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage draws" ON public.lottery_draws
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 5. prize_claims
CREATE TABLE public.prize_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  winner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','expired')),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prize_claims ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_prize_claims_winner ON public.prize_claims(winner_id, status);
CREATE POLICY "winner reads own claim" ON public.prize_claims
  FOR SELECT TO authenticated USING (auth.uid() = winner_id);
CREATE POLICY "admins manage claims" ON public.prize_claims
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Helper: today's draw periods
CREATE OR REPLACE FUNCTION public.current_week_start() RETURNS date
  LANGUAGE sql STABLE AS $$ SELECT date_trunc('week', CURRENT_DATE)::date $$;
CREATE OR REPLACE FUNCTION public.current_month_start() RETURNS date
  LANGUAGE sql STABLE AS $$ SELECT date_trunc('month', CURRENT_DATE)::date $$;

-- RPC: mark availability + grant tickets + update streak (atomic)
CREATE OR REPLACE FUNCTION public.mark_daily_availability(_available boolean)
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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO existing FROM public.daily_availability WHERE user_id = uid AND date = today;
  IF FOUND THEN
    RETURN jsonb_build_object('already', true, 'available', existing.available);
  END IF;

  INSERT INTO public.daily_availability (user_id, date, available) VALUES (uid, today, _available);

  IF _available THEN
    -- Daily ticket (today's draw)
    INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source)
    VALUES (uid, 'daily', today, 'availability');
    -- Weekly ticket (current week's draw)
    INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source)
    VALUES (uid, 'weekly', current_week_start(), 'availability');
    -- Monthly ticket — for next month per spec
    INSERT INTO public.lottery_tickets (user_id, ticket_type, draw_period_start, source)
    VALUES (uid, 'monthly', (current_month_start() + interval '1 month')::date, 'availability');

    -- Streak update
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
  ELSE
    -- Reset streak on "not available"
    INSERT INTO public.streak_tracker (user_id, current_streak, longest_streak, last_check_date)
    VALUES (uid, 0, 0, today)
    ON CONFLICT (user_id) DO UPDATE
      SET current_streak = 0, last_check_date = today, updated_at = now();
  END IF;

  RETURN jsonb_build_object('already', false, 'available', _available, 'streak', new_streak);
END;
$$;
