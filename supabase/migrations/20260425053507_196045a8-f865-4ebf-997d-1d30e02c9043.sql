-- 1. Add parent_id to post_comments for threaded replies
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx ON public.post_comments(parent_id);
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments(post_id);

-- 2. comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes readable by auth"
  ON public.comment_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "users insert own comment_likes"
  ON public.comment_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own comment_likes"
  ON public.comment_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Notify on reply
CREATE OR REPLACE FUNCTION public.notify_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE parent_owner uuid; replier_name text;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO parent_owner FROM public.post_comments WHERE id = NEW.parent_id;
  IF parent_owner IS NULL OR parent_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO replier_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
  VALUES (parent_owner, 'reply', COALESCE(replier_name, 'Someone') || ' replied to your comment', LEFT(NEW.content, 120), NEW.user_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_on_reply ON public.post_comments;
CREATE TRIGGER trg_notify_on_reply
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reply();

-- 4. Notify on comment-like
CREATE OR REPLACE FUNCTION public.notify_on_comment_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner_id uuid; liker_name text;
BEGIN
  SELECT user_id INTO owner_id FROM public.post_comments WHERE id = NEW.comment_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO liker_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
  VALUES (owner_id, 'comment_like', COALESCE(liker_name, 'Someone') || ' liked your comment', NULL, NEW.user_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_on_comment_like ON public.comment_likes;
CREATE TRIGGER trg_notify_on_comment_like
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_like();

-- 5. Make sure post-likes/comments triggers exist (re-create idempotently)
DROP TRIGGER IF EXISTS trg_notify_on_like ON public.post_likes;
CREATE TRIGGER trg_notify_on_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.post_comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
