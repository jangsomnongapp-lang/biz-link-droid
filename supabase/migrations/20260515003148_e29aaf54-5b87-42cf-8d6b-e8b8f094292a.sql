
-- 1) Lock additional role flags on profiles to prevent self-promotion
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;

CREATE POLICY "users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin        = (SELECT p.is_admin        FROM public.profiles p WHERE p.id = auth.uid())
  AND is_super_user   = (SELECT p.is_super_user   FROM public.profiles p WHERE p.id = auth.uid())
  AND is_supplier     = (SELECT p.is_supplier     FROM public.profiles p WHERE p.id = auth.uid())
  AND is_recruiter    = (SELECT p.is_recruiter    FROM public.profiles p WHERE p.id = auth.uid())
  AND is_verified     = (SELECT p.is_verified     FROM public.profiles p WHERE p.id = auth.uid())
  AND is_featured     = (SELECT p.is_featured     FROM public.profiles p WHERE p.id = auth.uid())
  AND is_organization = (SELECT p.is_organization FROM public.profiles p WHERE p.id = auth.uid())
  AND is_coordinator  = (SELECT p.is_coordinator  FROM public.profiles p WHERE p.id = auth.uid())
  AND is_specialist   = (SELECT p.is_specialist   FROM public.profiles p WHERE p.id = auth.uid())
  AND is_provider     = (SELECT p.is_provider     FROM public.profiles p WHERE p.id = auth.uid())
  AND is_client       = (SELECT p.is_client       FROM public.profiles p WHERE p.id = auth.uid())
  AND member_number IS NOT DISTINCT FROM (SELECT p.member_number FROM public.profiles p WHERE p.id = auth.uid())
  AND master_account_id IS NOT DISTINCT FROM (SELECT p.master_account_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- 2) Storage: project-photos INSERT must verify uploader is project participant
DROP POLICY IF EXISTS "auth users upload project photos" ON storage.objects;

CREATE POLICY "auth users upload project photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE (p.id)::text = (storage.foldername(name))[2]
      AND (p.owner_id = auth.uid() OR p.worker_id = auth.uid())
  )
);

-- 3) Lock supplier_invites once consumed: prevent any UPDATE on used invites
CREATE OR REPLACE FUNCTION public.lock_used_supplier_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.used_by IS NOT NULL OR OLD.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Supplier invite has already been consumed and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_used_supplier_invite ON public.supplier_invites;
CREATE TRIGGER trg_lock_used_supplier_invite
BEFORE UPDATE ON public.supplier_invites
FOR EACH ROW EXECUTE FUNCTION public.lock_used_supplier_invite();
