CREATE TABLE public.rental_request_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.rental_requests(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_request_photos TO authenticated;
GRANT ALL ON public.rental_request_photos TO service_role;

ALTER TABLE public.rental_request_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request photos readable with parent"
ON public.rental_request_photos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rental_requests r
    WHERE r.id = rental_request_photos.request_id
      AND (r.status = 'active' OR r.user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

CREATE POLICY "users insert photos on own requests"
ON public.rental_request_photos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rental_requests r WHERE r.id = rental_request_photos.request_id AND r.user_id = auth.uid())
);

CREATE POLICY "users update photos on own requests"
ON public.rental_request_photos FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.rental_requests r WHERE r.id = rental_request_photos.request_id AND r.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rental_requests r WHERE r.id = rental_request_photos.request_id AND r.user_id = auth.uid())
);

CREATE POLICY "users delete photos on own requests"
ON public.rental_request_photos FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.rental_requests r WHERE r.id = rental_request_photos.request_id AND r.user_id = auth.uid())
);

CREATE INDEX idx_rental_request_photos_request ON public.rental_request_photos(request_id, sort_order);