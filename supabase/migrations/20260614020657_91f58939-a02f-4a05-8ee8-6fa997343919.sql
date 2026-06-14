UPDATE public.categories SET name_en = 'Formwork & Steel fixer', name_km = 'ជាងពុម្ព និងកម្មករចងដែក' WHERE id = 'd3f34533-6d08-4f44-bc93-d0f74d7f9656';

INSERT INTO public.user_categories (user_id, category_id)
SELECT user_id, 'd3f34533-6d08-4f44-bc93-d0f74d7f9656' FROM public.user_categories
WHERE category_id = '19dad38c-8dbb-4843-8dec-288799635611'
ON CONFLICT (user_id, category_id) DO NOTHING;

DELETE FROM public.user_categories WHERE category_id = '19dad38c-8dbb-4843-8dec-288799635611';

INSERT INTO public.listing_categories (listing_id, category_id)
SELECT listing_id, 'd3f34533-6d08-4f44-bc93-d0f74d7f9656' FROM public.listing_categories
WHERE category_id = '19dad38c-8dbb-4843-8dec-288799635611'
ON CONFLICT (listing_id, category_id) DO NOTHING;

DELETE FROM public.listing_categories WHERE category_id = '19dad38c-8dbb-4843-8dec-288799635611';

DELETE FROM public.categories WHERE id = '19dad38c-8dbb-4843-8dec-288799635611';