ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_category_check CHECK (category IS NULL OR category IN ('electrical','cement','steel','zinc','tools','timber','sanitary','paint','other'));
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts (category) WHERE category IS NOT NULL;