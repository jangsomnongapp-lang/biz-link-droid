DROP POLICY "request photos readable with parent" ON public.rental_request_photos;
CREATE POLICY "request photos readable with parent"
ON public.rental_request_photos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rental_requests r
    WHERE r.id = rental_request_photos.request_id
      AND (r.status = 'approved' OR r.user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);