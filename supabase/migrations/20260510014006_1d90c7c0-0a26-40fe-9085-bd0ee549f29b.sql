
-- =========================
-- projects
-- =========================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined','completed')),
  agreed_price numeric NULL,
  checkin_required boolean NOT NULL DEFAULT false,
  checkout_required boolean NOT NULL DEFAULT false,
  photo_frequency text NULL CHECK (photo_frequency IN ('morning','midday','endofday')),
  start_date date NULL,
  duration text NULL,
  completion_requested_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_id <> worker_id)
);
CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_worker ON public.projects(worker_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read project"
  ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = worker_id);

CREATE POLICY "owner inserts project"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "participants update project"
  ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = worker_id);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: is the current user a participant in a project
CREATE OR REPLACE FUNCTION public.is_project_participant(_pid uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _pid AND (p.owner_id = _uid OR p.worker_id = _uid)
  );
$$;

-- =========================
-- project_logs
-- =========================
CREATE TABLE public.project_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  log_type text NOT NULL CHECK (log_type IN ('checkin','checkout','photo')),
  photo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_logs_project ON public.project_logs(project_id, created_at DESC);

ALTER TABLE public.project_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read logs"
  ON public.project_logs FOR SELECT TO authenticated
  USING (public.is_project_participant(project_id, auth.uid()));

CREATE POLICY "participants insert logs"
  ON public.project_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_project_participant(project_id, auth.uid()));

-- =========================
-- project_ratings
-- =========================
CREATE TABLE public.project_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL,
  rated_id uuid NOT NULL,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text NULL CHECK (comment IS NULL OR char_length(comment) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, rater_id)
);
CREATE INDEX idx_project_ratings_rated ON public.project_ratings(rated_id);

ALTER TABLE public.project_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings public read"
  ON public.project_ratings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "participants insert rating"
  ON public.project_ratings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = rater_id
    AND public.is_project_participant(project_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.status = 'completed')
  );

-- =========================
-- project_messages
-- =========================
CREATE TABLE public.project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_messages_project ON public.project_messages(project_id, created_at);

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read project messages"
  ON public.project_messages FOR SELECT TO authenticated
  USING (public.is_project_participant(project_id, auth.uid()));

CREATE POLICY "participants insert project messages"
  ON public.project_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_project_participant(project_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- =========================
-- Notifications on status change
-- =========================
CREATE OR REPLACE FUNCTION public.notify_on_project_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_name text;
  worker_name text;
BEGIN
  SELECT full_name INTO owner_name FROM public.profiles WHERE id = NEW.owner_id;
  SELECT full_name INTO worker_name FROM public.profiles WHERE id = NEW.worker_id;

  IF TG_OP = 'INSERT' THEN
    -- Notify worker of new project request
    INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
    VALUES (NEW.worker_id, 'project_request',
            COALESCE(owner_name,'Someone') || ' wants to start a project with you',
            NULL, NEW.owner_id);
    RETURN NEW;
  END IF;

  IF NEW.status <> OLD.status THEN
    IF NEW.status = 'active' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
      VALUES (NEW.owner_id, 'project_accepted',
              COALESCE(worker_name,'Worker') || ' accepted your project',
              NULL, NEW.worker_id);
    ELSIF NEW.status = 'declined' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
      VALUES (NEW.owner_id, 'project_declined',
              COALESCE(worker_name,'Worker') || ' declined your project',
              NULL, NEW.worker_id);
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
      VALUES (NEW.owner_id, 'project_completed', 'Project marked completed', NULL, NEW.worker_id);
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
      VALUES (NEW.worker_id, 'project_completed', 'Project marked completed', NULL, NEW.owner_id);
    END IF;
  END IF;

  -- Completion request
  IF NEW.completion_requested_by IS DISTINCT FROM OLD.completion_requested_by
     AND NEW.completion_requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
    VALUES (
      CASE WHEN NEW.completion_requested_by = NEW.owner_id THEN NEW.worker_id ELSE NEW.owner_id END,
      'project_completion_request',
      'Project finish requested — please confirm',
      NULL,
      NEW.completion_requested_by
    );
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER projects_notify_insert
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_event();

CREATE TRIGGER projects_notify_update
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_event();

-- =========================
-- Storage bucket for project photos
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-photos');

CREATE POLICY "auth users upload project photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own project photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
