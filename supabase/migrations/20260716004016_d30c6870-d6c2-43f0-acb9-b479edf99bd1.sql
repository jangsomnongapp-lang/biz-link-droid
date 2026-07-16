
CREATE OR REPLACE FUNCTION public.unread_message_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM public.messages m
  JOIN public.message_threads t ON t.id = m.thread_id
  WHERE m.read_at IS NULL
    AND m.sender_id <> _user_id
    AND (t.participant_a = _user_id OR t.participant_b = _user_id);
$$;

REVOKE ALL ON FUNCTION public.unread_message_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unread_message_count(uuid) TO authenticated;
