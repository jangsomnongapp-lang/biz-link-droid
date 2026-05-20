-- 1) Hide unannounced lottery winners
DROP POLICY IF EXISTS "all auth read draws" ON public.lottery_draws;
CREATE POLICY "auth read published or own draws"
ON public.lottery_draws FOR SELECT TO authenticated
USING (
  published_at IS NOT NULL
  OR status IN ('scheduled','no_entries')
  OR winner_user_id = auth.uid()
  OR is_admin(auth.uid())
);

-- 2) Project-photos delete must require current project participation
DROP POLICY IF EXISTS "users delete own project photos" ON storage.objects;
CREATE POLICY "participants delete project photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND (p.owner_id = auth.uid() OR p.worker_id = auth.uid())
  )
);