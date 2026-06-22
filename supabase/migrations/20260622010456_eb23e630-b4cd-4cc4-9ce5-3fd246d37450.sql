DROP POLICY IF EXISTS "super user reads group threads" ON public.message_threads;
DROP POLICY IF EXISTS "super user reads group messages" ON public.messages;

CREATE POLICY "super user reads group threads"
ON public.message_threads
FOR SELECT
TO authenticated
USING (
  public.current_master_user_id() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = message_threads.participant_a
        AND (p.id = public.current_master_user_id() OR p.master_account_id = public.current_master_user_id())
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = message_threads.participant_b
        AND (p.id = public.current_master_user_id() OR p.master_account_id = public.current_master_user_id())
    )
  )
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
      AND public.current_master_user_id() IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = t.participant_a
            AND (p.id = public.current_master_user_id() OR p.master_account_id = public.current_master_user_id())
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = t.participant_b
            AND (p.id = public.current_master_user_id() OR p.master_account_id = public.current_master_user_id())
        )
      )
  )
);