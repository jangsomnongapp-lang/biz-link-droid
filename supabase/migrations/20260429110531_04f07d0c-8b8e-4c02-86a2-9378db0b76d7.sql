-- Invite codes: one per user
CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_codes readable by everyone"
  ON public.invite_codes FOR SELECT
  USING (true);

CREATE POLICY "users insert own invite_code"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Invite clicks: each click on an invite link
CREATE TABLE public.invite_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  inviter_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_clicks_inviter ON public.invite_clicks(inviter_id);
CREATE INDEX idx_invite_clicks_created ON public.invite_clicks(created_at);

ALTER TABLE public.invite_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert invite_clicks"
  ON public.invite_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "inviter reads own clicks"
  ON public.invite_clicks FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR is_admin(auth.uid()));

-- Invite joins: successful signups
CREATE TABLE public.invite_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_joins_inviter ON public.invite_joins(inviter_id);
CREATE INDEX idx_invite_joins_created ON public.invite_joins(created_at);

ALTER TABLE public.invite_joins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_joins readable by auth"
  ON public.invite_joins FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users insert own invite_join"
  ON public.invite_joins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = invitee_id);

-- Invite rewards: tier tracking
CREATE TABLE public.invite_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE(user_id, tier)
);

ALTER TABLE public.invite_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own rewards"
  ON public.invite_rewards FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "system inserts rewards"
  ON public.invite_rewards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "admins update rewards"
  ON public.invite_rewards FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));