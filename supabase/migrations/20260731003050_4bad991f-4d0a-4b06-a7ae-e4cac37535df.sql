
-- Generic guard: restore protected columns to their previous values for non-admins
CREATE OR REPLACE FUNCTION public.guard_listing_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  NEW.status := OLD.status;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_material_request_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  NEW.user_id := OLD.user_id;
  NEW.category := OLD.category;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_project_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.worker_id := OLD.worker_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_listings_fields ON public.listings;
CREATE TRIGGER guard_listings_fields BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_fields();

DROP TRIGGER IF EXISTS guard_posts_fields ON public.posts;
CREATE TRIGGER guard_posts_fields BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_fields();

DROP TRIGGER IF EXISTS guard_stories_fields ON public.stories;
CREATE TRIGGER guard_stories_fields BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_fields();

DROP TRIGGER IF EXISTS guard_rental_listings_fields ON public.rental_listings;
CREATE TRIGGER guard_rental_listings_fields BEFORE UPDATE ON public.rental_listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_fields();

DROP TRIGGER IF EXISTS guard_supplier_stores_fields ON public.supplier_stores;
CREATE TRIGGER guard_supplier_stores_fields BEFORE UPDATE ON public.supplier_stores
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_fields();

DROP TRIGGER IF EXISTS guard_material_requests_fields ON public.material_requests;
CREATE TRIGGER guard_material_requests_fields BEFORE UPDATE ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_material_request_fields();

DROP TRIGGER IF EXISTS guard_projects_fields ON public.projects;
CREATE TRIGGER guard_projects_fields BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_fields();

-- Replace ineffective self-referencing WITH CHECK expressions
DROP POLICY IF EXISTS "users update own listings" ON public.listings;
CREATE POLICY "users update own listings" ON public.listings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own posts" ON public.posts;
CREATE POLICY "users update own posts" ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own stories" ON public.stories;
CREATE POLICY "users update own stories" ON public.stories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own rentals" ON public.rental_listings;
CREATE POLICY "Users can update their own rentals" ON public.rental_listings FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()))
  WITH CHECK ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "owner updates own store" ON public.supplier_stores;
CREATE POLICY "owner updates own store" ON public.supplier_stores FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner updates own request" ON public.material_requests;
CREATE POLICY "owner updates own request" ON public.material_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "participants update project" ON public.projects;
CREATE POLICY "participants update project" ON public.projects FOR UPDATE TO authenticated
  USING ((auth.uid() = owner_id) OR (auth.uid() = worker_id))
  WITH CHECK ((auth.uid() = owner_id) OR (auth.uid() = worker_id));
