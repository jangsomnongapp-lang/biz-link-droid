CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.rental_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  budget_per_day NUMERIC,
  needed_from DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active rental_requests readable by auth"
ON public.rental_requests FOR SELECT TO authenticated
USING (status = 'active' OR auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "users insert own rental_requests"
ON public.rental_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own rental_requests"
ON public.rental_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "users delete own rental_requests"
ON public.rental_requests FOR DELETE TO authenticated
USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TRIGGER update_rental_requests_updated_at
BEFORE UPDATE ON public.rental_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_rental_requests_status_created ON public.rental_requests(status, created_at DESC);
CREATE INDEX idx_rental_requests_user ON public.rental_requests(user_id);