-- Supplier categories (separate from existing categories)
CREATE TABLE public.supplier_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_km text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_categories readable by everyone" ON public.supplier_categories
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.supplier_categories (code, name_en, name_km, sort_order) VALUES
  ('hardware','Hardware store','ហាងគ្រឿងសំណង់',1),
  ('paint','Paint & finishes','ថ្នាំលាប',2),
  ('electrical','Electrical supplies','គ្រឿងអគ្គិសនី',3),
  ('plumbing','Plumbing supplies','គ្រឿងបំពង់ទឹក',4),
  ('tiles','Tiles & flooring','ក្បឿង​ និង​កម្រាល',5),
  ('wood','Wood & carpentry','ឈើ និង​ជាង​ឈើ',6),
  ('steel','Steel & iron','ដែក​ និង​ដែក​សំ',7),
  ('tools','Tools & equipment','ឧបករណ៍',8),
  ('furniture','Furniture','គ្រឿង​សង្ហារិម',9),
  ('cladding','Cladding & Panels','ផ្ទាំង​បិទ​ជញ្ជាំង',10);

-- Add is_supplier flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_supplier boolean NOT NULL DEFAULT false;

-- Update handle_new_user trigger to include is_supplier
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  insert into public.profiles (id, full_name, phone, is_provider, is_coordinator, is_organization, is_client, is_specialist, is_supplier, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    coalesce((new.raw_user_meta_data->>'is_provider')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_coordinator')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_organization')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_client')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_specialist')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_supplier')::boolean, false),
    coalesce(new.raw_user_meta_data->>'language', 'km')
  );
  return new;
end;
$$;

-- Supplier invites (admin-generated tokens)
CREATE TABLE public.supplier_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  note text,
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read supplier invite by token" ON public.supplier_invites
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage supplier invites" ON public.supplier_invites
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "invitee marks used" ON public.supplier_invites
  FOR UPDATE TO authenticated USING (auth.uid() = used_by OR is_admin(auth.uid()));

-- Supplier stores
CREATE TABLE public.supplier_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  location text,
  description text,
  logo_url text,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_stores readable by auth" ON public.supplier_stores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner inserts own store" ON public.supplier_stores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner updates own store" ON public.supplier_stores
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage stores" ON public.supplier_stores
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER set_supplier_stores_updated_at
  BEFORE UPDATE ON public.supplier_stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Store ↔ supplier category
CREATE TABLE public.supplier_store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.supplier_stores(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.supplier_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, category_id)
);
ALTER TABLE public.supplier_store_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_cats readable" ON public.supplier_store_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner manages store_cats" ON public.supplier_store_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = supplier_store_categories.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = supplier_store_categories.store_id AND s.user_id = auth.uid()));

-- Store featured product photos
CREATE TABLE public.supplier_store_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.supplier_stores(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_store_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_photos readable" ON public.supplier_store_photos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner manages store_photos" ON public.supplier_store_photos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = supplier_store_photos.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = supplier_store_photos.store_id AND s.user_id = auth.uid()));

-- Storage bucket for supplier store assets
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-stores', 'supplier-stores', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "supplier-stores readable by everyone" ON storage.objects
  FOR SELECT USING (bucket_id = 'supplier-stores');
CREATE POLICY "users upload to own supplier-stores folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-stores' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own supplier-stores files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'supplier-stores' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own supplier-stores files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-stores' AND auth.uid()::text = (storage.foldername(name))[1]);