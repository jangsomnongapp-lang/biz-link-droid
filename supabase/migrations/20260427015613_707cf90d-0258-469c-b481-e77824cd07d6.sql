CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('post','listing','profile')),
  target_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "users read own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "admins read all reports" ON public.reports
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admins update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admins delete reports" ON public.reports
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_target ON public.reports(target_kind, target_id);