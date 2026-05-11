
-- Re-assert column-level revoke on profiles.phone
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;

-- Add UPDATE policy for project-photos bucket scoped to owner folder
DROP POLICY IF EXISTS "project_photos owner update" ON storage.objects;
CREATE POLICY "project_photos owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-photos' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'project-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);
