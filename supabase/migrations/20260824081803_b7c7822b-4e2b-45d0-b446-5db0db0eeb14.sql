ALTER TABLE public.posts DROP CONSTRAINT posts_category_check;

CREATE OR REPLACE FUNCTION public.validate_post_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supplier_categories sc WHERE sc.code = NEW.category
  ) THEN
    RAISE EXCEPTION 'invalid product category: %', NEW.category;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_post_category_trigger ON public.posts;
CREATE TRIGGER validate_post_category_trigger
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.validate_post_category();