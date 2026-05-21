-- 1) Lock down profiles.phone column-level access.
-- Authenticated/anon roles can no longer SELECT the phone column directly.
-- Access goes through public.get_user_phone(uuid), which enforces owner/admin checks.
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;

-- 2) Tighten storage delete policy on project-photos to disallow deletion
-- once a project is no longer active/pending (e.g. completed or cancelled).
DROP POLICY IF EXISTS "participants delete project photos" ON storage.objects;

CREATE POLICY "participants delete project photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE (p.id)::text = (storage.foldername(objects.name))[2]
      AND (p.owner_id = auth.uid() OR p.worker_id = auth.uid())
      AND p.status IN ('active', 'pending')
  )
);