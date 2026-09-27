CREATE POLICY "Users can update own reaction"
ON public.post_likes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN public.post_likes.reaction IS 'Reaction type: like, love, haha, wow, sad. Users may change their own reaction via UPDATE.';