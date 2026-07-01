
-- Enforce immutable identity columns on message_threads and messages via triggers,
-- and add WITH CHECK clauses to UPDATE policies.

CREATE OR REPLACE FUNCTION public.enforce_message_thread_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.participant_a IS DISTINCT FROM OLD.participant_a
     OR NEW.participant_b IS DISTINCT FROM OLD.participant_b
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot modify thread participants';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_threads_immutable ON public.message_threads;
CREATE TRIGGER message_threads_immutable
BEFORE UPDATE ON public.message_threads
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_thread_immutable();

DROP POLICY IF EXISTS "participants update threads" ON public.message_threads;
CREATE POLICY "participants update threads" ON public.message_threads
FOR UPDATE TO authenticated
USING ((auth.uid() = participant_a) OR (auth.uid() = participant_b))
WITH CHECK ((auth.uid() = participant_a) OR (auth.uid() = participant_b));

CREATE OR REPLACE FUNCTION public.enforce_message_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.thread_id IS DISTINCT FROM OLD.thread_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only read_at may be updated on messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_immutable ON public.messages;
CREATE TRIGGER messages_immutable
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_immutable();

DROP POLICY IF EXISTS "recipients mark read" ON public.messages;
CREATE POLICY "recipients mark read" ON public.messages
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.message_threads t
  WHERE t.id = messages.thread_id
    AND ((auth.uid() = t.participant_a) OR (auth.uid() = t.participant_b))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.message_threads t
  WHERE t.id = messages.thread_id
    AND ((auth.uid() = t.participant_a) OR (auth.uid() = t.participant_b))
));
