ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_post_id uuid;

CREATE INDEX IF NOT EXISTS notifications_related_post_id_idx ON public.notifications(related_post_id);

CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; liker_name text;
BEGIN
  SELECT user_id INTO owner_id FROM public.posts WHERE id = NEW.post_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO liker_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_post_id)
  VALUES (owner_id, 'like', COALESCE(liker_name, 'Someone') || ' liked your post', NULL, NEW.user_id, NEW.post_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; commenter_name text;
BEGIN
  SELECT user_id INTO owner_id FROM public.posts WHERE id = NEW.post_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_post_id)
  VALUES (owner_id, 'comment', COALESCE(commenter_name, 'Someone') || ' commented on your post', LEFT(NEW.content, 120), NEW.user_id, NEW.post_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_owner uuid; replier_name text; parent_post uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id, post_id INTO parent_owner, parent_post FROM public.post_comments WHERE id = NEW.parent_id;
  IF parent_owner IS NULL OR parent_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO replier_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_post_id)
  VALUES (parent_owner, 'reply', COALESCE(replier_name, 'Someone') || ' replied to your comment', LEFT(NEW.content, 120), NEW.user_id, parent_post);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_comment_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; liker_name text; parent_post uuid;
BEGIN
  SELECT user_id, post_id INTO owner_id, parent_post FROM public.post_comments WHERE id = NEW.comment_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO liker_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id, related_post_id)
  VALUES (owner_id, 'comment_like', COALESCE(liker_name, 'Someone') || ' liked your comment', NULL, NEW.user_id, parent_post);
  RETURN NEW;
END; $$;