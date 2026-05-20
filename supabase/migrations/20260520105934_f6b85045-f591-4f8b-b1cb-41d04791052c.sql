-- Tighten lottery draw visibility so draft/scheduled rows cannot expose winner identifiers
DROP POLICY IF EXISTS "auth read published or own draws" ON public.lottery_draws;

CREATE POLICY "auth read safe published or own draws"
ON public.lottery_draws
FOR SELECT
TO authenticated
USING (
  published_at IS NOT NULL
  OR winner_user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR (
    status IN ('scheduled', 'no_entries')
    AND winner_user_id IS NULL
    AND winning_ticket_id IS NULL
  )
);

-- Require current project participation for project photo overwrites, matching insert/delete rules
DROP POLICY IF EXISTS "project_photos owner update" ON storage.objects;

CREATE POLICY "participants update project photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND (p.owner_id = auth.uid() OR p.worker_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'project-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND (p.owner_id = auth.uid() OR p.worker_id = auth.uid())
  )
);