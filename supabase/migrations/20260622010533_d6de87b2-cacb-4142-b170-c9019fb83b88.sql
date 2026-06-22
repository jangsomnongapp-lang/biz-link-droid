CREATE OR REPLACE FUNCTION public.user_belongs_to_current_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_master_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user_id
        AND (
          p.id = public.current_master_user_id()
          OR p.master_account_id = public.current_master_user_id()
        )
    );
$$;

REVOKE ALL ON FUNCTION public.user_belongs_to_current_master(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_current_master(uuid) TO authenticated;

DROP POLICY IF EXISTS "super user reads group threads" ON public.message_threads;
DROP POLICY IF EXISTS "super user reads group messages" ON public.messages;

CREATE POLICY "super user reads group threads"
ON public.message_threads
FOR SELECT
TO authenticated
USING (
  public.user_belongs_to_current_master(participant_a)
  OR public.user_belongs_to_current_master(participant_b)
);

CREATE POLICY "super user reads group messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.message_threads t
    WHERE t.id = messages.thread_id
      AND (
        public.user_belongs_to_current_master(t.participant_a)
        OR public.user_belongs_to_current_master(t.participant_b)
      )
  )
);