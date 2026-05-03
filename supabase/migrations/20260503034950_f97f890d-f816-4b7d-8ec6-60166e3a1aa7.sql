
-- rental_listings table
CREATE TABLE public.rental_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('vehicles','heavy','light','tools')),
  price_per_day NUMERIC(10,2) NOT NULL,
  min_days INTEGER NOT NULL DEFAULT 1,
  availability TEXT NOT NULL DEFAULT 'now' CHECK (availability IN ('now','from_date')),
  available_from DATE,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','rented','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rental_listings_status ON public.rental_listings(status);
CREATE INDEX idx_rental_listings_user ON public.rental_listings(user_id);
CREATE INDEX idx_rental_listings_category ON public.rental_listings(category);

ALTER TABLE public.rental_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved rentals"
ON public.rental_listings FOR SELECT
USING (status = 'approved' OR auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert their own rentals"
ON public.rental_listings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rentals"
ON public.rental_listings FOR UPDATE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can delete their own rentals"
ON public.rental_listings FOR DELETE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_rental_listings_updated_at
BEFORE UPDATE ON public.rental_listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- rental_photos table
CREATE TABLE public.rental_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.rental_listings(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rental_photos_listing ON public.rental_photos(listing_id);

ALTER TABLE public.rental_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rental photos for approved listings"
ON public.rental_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rental_listings rl
    WHERE rl.id = listing_id
      AND (rl.status = 'approved' OR rl.user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

CREATE POLICY "Owner can insert rental photos"
ON public.rental_photos FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rental_listings rl WHERE rl.id = listing_id AND rl.user_id = auth.uid())
);

CREATE POLICY "Owner can delete rental photos"
ON public.rental_photos FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.rental_listings rl WHERE rl.id = listing_id AND (rl.user_id = auth.uid() OR public.is_admin(auth.uid())))
);

-- Trigger: enforce max 4 photos per listing
CREATE OR REPLACE FUNCTION public.enforce_rental_photo_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.rental_photos WHERE listing_id = NEW.listing_id) >= 4 THEN
    RAISE EXCEPTION 'Max 4 photos per rental listing';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rental_photos_limit
BEFORE INSERT ON public.rental_photos
FOR EACH ROW EXECUTE FUNCTION public.enforce_rental_photo_limit();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('rental-photos', 'rental-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Rental photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'rental-photos');

CREATE POLICY "Users can upload to own rental folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rental-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own rental folder files"
ON storage.objects FOR DELETE
USING (bucket_id = 'rental-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Telegram notification on new rental
CREATE OR REPLACE FUNCTION public.tg_notify_new_rental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name text;
BEGIN
  SELECT full_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify_telegram('rental', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'user_name', COALESCE(_name, 'Someone'),
    'title', NEW.title,
    'category', NEW.category,
    'price_per_day', NEW.price_per_day,
    'status', NEW.status
  ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_rental
AFTER INSERT ON public.rental_listings
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_rental();

-- Notify owner on approval/rejection
CREATE OR REPLACE FUNCTION public.notify_on_rental_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> OLD.status AND NEW.status IN ('approved','rejected') THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'approved' THEN 'rental_approved' ELSE 'rental_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN 'Your rental "' || NEW.title || '" was approved'
        ELSE 'Your rental "' || NEW.title || '" was rejected' END,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_rental_status
AFTER UPDATE ON public.rental_listings
FOR EACH ROW EXECUTE FUNCTION public.notify_on_rental_status();
