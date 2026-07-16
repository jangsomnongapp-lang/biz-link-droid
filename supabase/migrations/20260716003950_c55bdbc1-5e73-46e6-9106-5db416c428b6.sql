
-- Speed up unread-messages count (AppShell badge, called ~every 15s per user)
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (thread_id, sender_id)
  WHERE read_at IS NULL;

-- Speed up notifications unread count
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

-- Speed up thread lookup by participant (used to build the thread-id list)
CREATE INDEX IF NOT EXISTS idx_message_threads_participant_a
  ON public.message_threads (participant_a);
CREATE INDEX IF NOT EXISTS idx_message_threads_participant_b
  ON public.message_threads (participant_b);

-- Active stories filter (status='active' AND expires_at > now() ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_stories_active_created
  ON public.stories (created_at DESC)
  WHERE status = 'active';
