DROP POLICY IF EXISTS "participants update project" ON public.projects;

CREATE POLICY "participants update project"
ON public.projects
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() = worker_id)
WITH CHECK (
  (auth.uid() = owner_id OR auth.uid() = worker_id)
  AND owner_id = (SELECT p.owner_id FROM public.projects p WHERE p.id = projects.id)
  AND worker_id = (SELECT p.worker_id FROM public.projects p WHERE p.id = projects.id)
);