ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS reaction text NOT NULL DEFAULT 'like';
ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_reaction_check;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_reaction_check CHECK (reaction IN ('like','love','haha','wow','sad'));