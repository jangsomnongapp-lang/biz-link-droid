-- Notify listing owner when someone applies
CREATE OR REPLACE FUNCTION public.notify_on_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner_id uuid; listing_title text; applicant_name text;
BEGIN
  SELECT user_id, title INTO owner_id, listing_title FROM public.listings WHERE id = NEW.listing_id;
  IF owner_id IS NULL OR owner_id = NEW.applicant_id THEN RETURN NEW; END IF;
  SELECT full_name INTO applicant_name FROM public.profiles WHERE id = NEW.applicant_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_listing_id)
  VALUES (
    owner_id,
    'application',
    COALESCE(applicant_name, 'Someone') || ' applied to your project',
    listing_title,
    NEW.applicant_id,
    NEW.listing_id
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_on_application ON public.applications;
CREATE TRIGGER trg_notify_on_application
AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.notify_on_application();

-- Notify applicant when their application status changes to accepted
CREATE OR REPLACE FUNCTION public.notify_on_application_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner_id uuid; listing_title text; owner_name text;
BEGIN
  IF NEW.status = 'accepted' AND COALESCE(OLD.status, '') <> 'accepted' THEN
    SELECT user_id, title INTO owner_id, listing_title FROM public.listings WHERE id = NEW.listing_id;
    SELECT full_name INTO owner_name FROM public.profiles WHERE id = owner_id;
    INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_listing_id)
    VALUES (
      NEW.applicant_id,
      'accepted',
      'You were accepted for a project',
      COALESCE(listing_title, '') || COALESCE(' by ' || owner_name, ''),
      owner_id,
      NEW.listing_id
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_on_application_accepted ON public.applications;
CREATE TRIGGER trg_notify_on_application_accepted
AFTER UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_accepted();