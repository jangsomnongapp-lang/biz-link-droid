ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length
  CHECK (char_length(content) <= 10485760);

DROP POLICY IF EXISTS "invitee marks used" ON public.supplier_invites;