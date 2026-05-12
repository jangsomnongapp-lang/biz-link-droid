-- =====================================================================
-- FIND MY MATERIAL — schema, RLS, triggers, RPCs, storage
-- =====================================================================

-- ---------- tables -------------------------------------------------------

CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('electrical','cement','steel','zinc','tools','timber','sanitary','paint','other')),
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  location_filter text NOT NULL DEFAULT 'near_me' CHECK (location_filter IN ('near_me','anywhere')),
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','found','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_requests_user_idx ON public.material_requests(user_id);
CREATE INDEX material_requests_active_cat_idx ON public.material_requests(category, status) WHERE status = 'active';

CREATE TABLE public.material_request_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.material_requests(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_request_photos_req_idx ON public.material_request_photos(request_id);

CREATE TABLE public.material_request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.material_requests(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  response text NOT NULL CHECK (response IN ('available','unavailable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, supplier_id)
);
CREATE INDEX material_request_responses_req_idx ON public.material_request_responses(request_id);
CREATE INDEX material_request_responses_supplier_idx ON public.material_request_responses(supplier_id);

CREATE TABLE public.supplier_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL UNIQUE,
  min_quantity integer NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  categories text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- RLS ----------------------------------------------------------

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_request_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_settings ENABLE ROW LEVEL SECURITY;

-- helper: can supplier see this active request?
CREATE OR REPLACE FUNCTION public.supplier_can_see_request(_req_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.material_requests r
    JOIN public.supplier_settings s ON s.supplier_id = _uid
    WHERE r.id = _req_id
      AND r.status = 'active'
      AND r.category = ANY (s.categories)
      AND r.quantity >= s.min_quantity
  );
$$;

-- material_requests
CREATE POLICY "owner reads own requests" ON public.material_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "supplier reads matching active requests" ON public.material_requests
  FOR SELECT TO authenticated
  USING (status = 'active' AND public.supplier_can_see_request(id, auth.uid()));

CREATE POLICY "owner inserts own request" ON public.material_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner updates own request" ON public.material_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT r.user_id FROM public.material_requests r WHERE r.id = material_requests.id)
    AND category = (SELECT r.category FROM public.material_requests r WHERE r.id = material_requests.id)
  );

-- material_request_photos
CREATE POLICY "photos readable when parent readable" ON public.material_request_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.material_requests r
      WHERE r.id = material_request_photos.request_id
        AND (r.user_id = auth.uid() OR (r.status = 'active' AND public.supplier_can_see_request(r.id, auth.uid())))
    )
  );

CREATE POLICY "owner inserts photos" ON public.material_request_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.material_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );

CREATE POLICY "owner deletes photos" ON public.material_request_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.material_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );

-- material_request_responses
CREATE POLICY "supplier reads own responses" ON public.material_request_responses
  FOR SELECT TO authenticated
  USING (auth.uid() = supplier_id);

CREATE POLICY "owner reads available responses on own request" ON public.material_request_responses
  FOR SELECT TO authenticated
  USING (
    response = 'available'
    AND EXISTS (SELECT 1 FROM public.material_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
-- NOTE: owners cannot SELECT 'unavailable' responses — they get only the anonymous notification.

CREATE POLICY "supplier inserts own response" ON public.material_request_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = supplier_id
    AND public.supplier_can_see_request(request_id, auth.uid())
  );

-- supplier_settings
CREATE POLICY "supplier reads own settings" ON public.supplier_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = supplier_id);

CREATE POLICY "supplier upserts own settings" ON public.supplier_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = supplier_id);

CREATE POLICY "supplier updates own settings" ON public.supplier_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = supplier_id)
  WITH CHECK (auth.uid() = supplier_id);

-- ---------- triggers -----------------------------------------------------

-- limit 10 active per user
CREATE OR REPLACE FUNCTION public.enforce_active_request_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.material_requests
      WHERE user_id = NEW.user_id AND status = 'active') >= 10 THEN
    RAISE EXCEPTION 'active_request_limit_reached';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_material_requests_limit
  BEFORE INSERT ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_request_limit();

-- limit 3 photos per request
CREATE OR REPLACE FUNCTION public.enforce_material_photo_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.material_request_photos WHERE request_id = NEW.request_id) >= 3 THEN
    RAISE EXCEPTION 'Max 3 photos per material request';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_material_photos_limit
  BEFORE INSERT ON public.material_request_photos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_material_photo_limit();

-- updated_at on requests
CREATE TRIGGER trg_material_requests_updated_at
  BEFORE UPDATE ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_supplier_settings_updated_at
  BEFORE UPDATE ON public.supplier_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- fan-out notifications when a request is created
CREATE OR REPLACE FUNCTION public.notify_suppliers_on_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_name text;
BEGIN
  SELECT full_name INTO user_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
  SELECT s.supplier_id,
         'material_request',
         'New material request: ' || NEW.category,
         COALESCE(user_name, 'Someone') || ' needs ' || NEW.quantity || ' ' || NEW.category,
         NEW.user_id
  FROM public.supplier_settings s
  WHERE NEW.category = ANY (s.categories)
    AND NEW.quantity >= s.min_quantity
    AND s.supplier_id <> NEW.user_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_material_requests_notify
  AFTER INSERT ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_suppliers_on_request();

-- notify owner when supplier responds
CREATE OR REPLACE FUNCTION public.notify_owner_on_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_id uuid;
  cat text;
BEGIN
  SELECT user_id, category INTO owner_id, cat
  FROM public.material_requests WHERE id = NEW.request_id;
  IF owner_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.response = 'available' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
    VALUES (owner_id, 'material_available',
            'A supplier has your ' || cat || ' item',
            'Tap to chat with the supplier',
            NEW.supplier_id);
  ELSE
    -- anonymous: do NOT include supplier_id
    INSERT INTO public.notifications (user_id, kind, title, body, related_user_id)
    VALUES (owner_id, 'material_unavailable',
            'A supplier checked your request',
            'They don''t have this item right now',
            NULL);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_material_responses_notify
  AFTER INSERT ON public.material_request_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_response();

-- ---------- RPCs ---------------------------------------------------------

-- Open/find chat thread between user and supplier; insert a context system message
CREATE OR REPLACE FUNCTION public.start_material_chat(_request_id uuid, _supplier_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  req record;
  a uuid;
  b uuid;
  thread_id uuid;
  context_text text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO req FROM public.material_requests WHERE id = _request_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

  -- Caller must be either the request owner or the named supplier
  IF caller <> req.user_id AND caller <> _supplier_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  -- And the supplier must have actually responded available
  IF NOT EXISTS (
    SELECT 1 FROM public.material_request_responses
    WHERE request_id = _request_id AND supplier_id = _supplier_id AND response = 'available'
  ) THEN
    RAISE EXCEPTION 'Supplier has not confirmed availability';
  END IF;

  IF req.user_id < _supplier_id THEN
    a := req.user_id; b := _supplier_id;
  ELSE
    a := _supplier_id; b := req.user_id;
  END IF;

  SELECT id INTO thread_id FROM public.message_threads
  WHERE participant_a = a AND participant_b = b LIMIT 1;

  IF thread_id IS NULL THEN
    INSERT INTO public.message_threads (participant_a, participant_b)
    VALUES (a, b) RETURNING id INTO thread_id;
  END IF;

  context_text := '[material_request] ' || req.category || ' · ' || req.quantity || ' units'
                  || COALESCE(' · ' || req.note, '');

  -- Only insert context once per thread+request
  IF NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE thread_id = start_material_chat.thread_id
      AND content = context_text
  ) THEN
    INSERT INTO public.messages (thread_id, sender_id, content)
    VALUES (thread_id, caller, context_text);
  END IF;

  RETURN thread_id;
END; $$;

-- ---------- storage ------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('material-photos', 'material-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "material-photos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'material-photos');

CREATE POLICY "material-photos owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'material-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "material-photos owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'material-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );