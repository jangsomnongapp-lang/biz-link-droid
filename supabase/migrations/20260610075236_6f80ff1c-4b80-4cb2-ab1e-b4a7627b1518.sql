
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

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
    INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_project_id)
    VALUES (NEW.worker_id, 'project_request',
            COALESCE(owner_name,'Someone') || ' wants to start a project with you',
            NULL, NEW.owner_id, NEW.id);
    RETURN NEW;
  END IF;

  IF NEW.status <> OLD.status THEN
    IF NEW.status = 'active' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_project_id)
      VALUES (NEW.owner_id, 'project_accepted',
              COALESCE(worker_name,'Worker') || ' accepted your project',
              NULL, NEW.worker_id, NEW.id);
    ELSIF NEW.status = 'declined' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_project_id)
      VALUES (NEW.owner_id, 'project_declined',
              COALESCE(worker_name,'Worker') || ' declined your project',
              NULL, NEW.worker_id, NEW.id);
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_project_id)
      VALUES (NEW.owner_id, 'project_completed', 'Project marked completed', NULL, NEW.worker_id, NEW.id);
      INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_project_id)
      VALUES (NEW.worker_id, 'project_completed', 'Project marked completed', NULL, NEW.owner_id, NEW.id);
    END IF;
  END IF;

  IF NEW.completion_requested_by IS DISTINCT FROM OLD.completion_requested_by
     AND NEW.completion_requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_project_id)
    VALUES (
      CASE WHEN NEW.completion_requested_by = NEW.owner_id THEN NEW.worker_id ELSE NEW.owner_id END,
      'project_completion_request',
      'Project finish requested — please confirm',
      NULL,
      NEW.completion_requested_by,
      NEW.id
    );
  END IF;

  RETURN NEW;
END; $$;
