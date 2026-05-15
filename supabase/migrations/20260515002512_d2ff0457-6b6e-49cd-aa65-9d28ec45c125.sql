-- Harden Supabase Realtime: only allow postgres_changes subscriptions
-- (those re-apply the underlying table RLS per subscriber). Broadcast and
-- presence are not used by this app, so deny them by default.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated postgres_changes only" ON realtime.messages;

CREATE POLICY "authenticated postgres_changes only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');