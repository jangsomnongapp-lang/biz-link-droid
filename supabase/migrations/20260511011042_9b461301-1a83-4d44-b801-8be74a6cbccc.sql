
-- 1) Restrict phone column on profiles to owner/admin via RPC only
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;

-- 2) Fix supplier_invites privilege escalation: ensure caller can only claim for themselves
DROP POLICY IF EXISTS "invitee marks used" ON public.supplier_invites;
CREATE POLICY "invitee marks used"
ON public.supplier_invites
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    used_by IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  )
)
WITH CHECK (
  is_admin(auth.uid())
  OR (used_by = auth.uid())
);
