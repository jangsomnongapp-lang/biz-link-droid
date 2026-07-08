
-- Restrict direct reads on project_ratings to participants only.
DROP POLICY IF EXISTS "ratings public read" ON public.project_ratings;

CREATE POLICY "ratings participants read"
ON public.project_ratings
FOR SELECT
TO authenticated
USING (
  auth.uid() = rater_id
  OR auth.uid() = rated_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_ratings.project_id
      AND (p.owner_id = auth.uid() OR p.worker_id = auth.uid())
  )
);

-- Public-facing profile reviews via SECURITY DEFINER function.
-- Returns reviews for a given rated user (stars, comment, rater identity)
-- so profile pages can still display reputation without exposing the full table.
CREATE OR REPLACE FUNCTION public.get_user_reviews(_rated_id uuid)
RETURNS TABLE (
  id uuid,
  stars int,
  comment text,
  created_at timestamptz,
  rater_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.stars, r.comment, r.created_at, r.rater_id
  FROM public.project_ratings r
  WHERE r.rated_id = _rated_id
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_reviews(uuid) TO authenticated, anon;
