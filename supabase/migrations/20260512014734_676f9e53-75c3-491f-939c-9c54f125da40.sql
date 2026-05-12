ALTER TABLE public.supplier_stores
  ADD CONSTRAINT supplier_stores_logo_url_size_chk
  CHECK (logo_url IS NULL OR octet_length(logo_url) <= 2621440) NOT VALID;

ALTER TABLE public.supplier_store_photos
  ADD CONSTRAINT supplier_store_photos_photo_url_size_chk
  CHECK (octet_length(photo_url) <= 2621440) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_size_chk
  CHECK (avatar_url IS NULL OR octet_length(avatar_url) <= 2621440) NOT VALID;

ALTER TABLE public.portfolio_photos
  ADD CONSTRAINT portfolio_photos_photo_url_size_chk
  CHECK (octet_length(photo_url) <= 2621440) NOT VALID;

ALTER TABLE public.post_photos
  ADD CONSTRAINT post_photos_photo_url_size_chk
  CHECK (octet_length(photo_url) <= 2621440) NOT VALID;

ALTER TABLE public.listing_photos
  ADD CONSTRAINT listing_photos_photo_url_size_chk
  CHECK (octet_length(photo_url) <= 2621440) NOT VALID;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_media_url_size_chk
  CHECK (octet_length(media_url) <= 2621440) NOT VALID;

UPDATE storage.buckets SET public = false WHERE id IN ('project-photos', 'material-photos');

DROP POLICY IF EXISTS "project photos public read" ON storage.objects;
DROP POLICY IF EXISTS "material-photos public read" ON storage.objects;

CREATE POLICY "project-photos participants read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-photos'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND (p.owner_id = auth.uid() OR p.worker_id = auth.uid())
  )
);

CREATE POLICY "material-photos authorized read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'material-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.material_request_photos mp
      JOIN public.material_requests r ON r.id = mp.request_id
      WHERE mp.photo_url = name
        AND (r.user_id = auth.uid() OR public.supplier_can_see_request(r.id, auth.uid()))
    )
  )
);
