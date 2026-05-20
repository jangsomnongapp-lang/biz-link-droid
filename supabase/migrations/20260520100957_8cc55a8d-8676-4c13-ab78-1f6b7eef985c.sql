-- Change default status to pending so new requests go through moderation
ALTER TABLE public.rental_requests ALTER COLUMN status SET DEFAULT 'pending';

-- Migrate existing 'active' rows to 'approved' so they stay visible
UPDATE public.rental_requests SET status = 'approved' WHERE status = 'active';

-- Update SELECT policy: approved visible to all auth, owners + admins always see
DROP POLICY IF EXISTS "active rental_requests readable by auth" ON public.rental_requests;

CREATE POLICY "approved rental_requests readable by auth"
ON public.rental_requests FOR SELECT TO authenticated
USING (status = 'approved' OR auth.uid() = user_id OR is_admin(auth.uid()));