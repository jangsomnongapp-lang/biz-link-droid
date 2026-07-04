-- listing_categories
DROP POLICY IF EXISTS "listing_cats readable by auth" ON public.listing_categories;
CREATE POLICY "listing_cats readable by auth" ON public.listing_categories
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_categories.listing_id
      AND (l.status = ANY (ARRAY['active'::text,'approved'::text])
           OR l.user_id = auth.uid()
           OR public.is_admin(auth.uid()))
  )
);

-- listing_photos
DROP POLICY IF EXISTS "listing_photos readable" ON public.listing_photos;
CREATE POLICY "listing_photos readable" ON public.listing_photos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_photos.listing_id
      AND (l.status = ANY (ARRAY['active'::text,'approved'::text])
           OR l.user_id = auth.uid()
           OR public.is_admin(auth.uid()))
  )
);

-- post_photos
DROP POLICY IF EXISTS "post_photos readable" ON public.post_photos;
CREATE POLICY "post_photos readable" ON public.post_photos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_photos.post_id
      AND (p.status = 'approved'::text
           OR p.user_id = auth.uid()
           OR public.is_admin(auth.uid()))
  )
);

-- supplier_store_categories
DROP POLICY IF EXISTS "store_cats readable" ON public.supplier_store_categories;
CREATE POLICY "store_cats readable" ON public.supplier_store_categories
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.supplier_stores s
    WHERE s.id = supplier_store_categories.store_id
      AND (s.status = 'approved'::text
           OR s.user_id = auth.uid()
           OR public.is_admin(auth.uid()))
  )
);

-- supplier_store_photos
DROP POLICY IF EXISTS "store_photos readable" ON public.supplier_store_photos;
CREATE POLICY "store_photos readable" ON public.supplier_store_photos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.supplier_stores s
    WHERE s.id = supplier_store_photos.store_id
      AND (s.status = 'approved'::text
           OR s.user_id = auth.uid()
           OR public.is_admin(auth.uid()))
  )
);