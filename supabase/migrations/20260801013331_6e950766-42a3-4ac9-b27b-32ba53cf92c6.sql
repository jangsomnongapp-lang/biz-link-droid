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

CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.supplier_categories(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_km text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalog_products TO anon;
GRANT SELECT ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog products are public" ON public.catalog_products
  FOR SELECT USING (is_active);

CREATE POLICY "admins manage catalog products" ON public.catalog_products
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_catalog_products_category ON public.catalog_products(category_id, sort_order);

CREATE TABLE public.supplier_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.supplier_stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.supplier_categories(id) ON DELETE SET NULL,
  name_en text NOT NULL,
  name_km text,
  unit text NOT NULL DEFAULT 'unit',
  price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  in_stock boolean NOT NULL DEFAULT true,
  photo_url text,
  note text,
  source text NOT NULL DEFAULT 'list',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_catalog_items TO authenticated;
GRANT ALL ON public.supplier_catalog_items TO service_role;

ALTER TABLE public.supplier_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own catalog items" ON public.supplier_catalog_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = store_id AND s.user_id = auth.uid()));

CREATE POLICY "approved store catalog items are viewable" ON public.supplier_catalog_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_stores s WHERE s.id = store_id AND s.status IN ('active','approved')));

CREATE POLICY "admins view all catalog items" ON public.supplier_catalog_items
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_supplier_catalog_items_store ON public.supplier_catalog_items(store_id, created_at DESC);
CREATE UNIQUE INDEX idx_supplier_catalog_items_store_product ON public.supplier_catalog_items(store_id, product_id) WHERE product_id IS NOT NULL;

CREATE TRIGGER trg_catalog_products_updated_at BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_supplier_catalog_items_updated_at BEFORE UPDATE ON public.supplier_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.catalog_products (category_id, name_en, name_km, unit, sort_order)
SELECT c.id, v.name_en, v.name_km, v.unit, v.sort_order
FROM (VALUES
  ('cement','Portland cement 50kg','ស៊ីម៉ង់ត៍ ៥០គីឡូ','bag',1),
  ('cement','Cement K1 50kg','ស៊ីម៉ង់ត៍ K1 ៥០គីឡូ','bag',2),
  ('cement','Ready-mix concrete','បេតុងលាយស្រេច','m3',3),
  ('cement','Sand (fine)','ខ្សាច់ល្អិត','m3',4),
  ('cement','Sand (coarse)','ខ្សាច់គ្រើម','m3',5),
  ('cement','Gravel 1x2','គ្រួស ១x២','m3',6),
  ('cement','Crushed stone','ថ្មបំបែក','m3',7),
  ('cement','Mortar mix','ស៊ីម៉ង់ត៍លាយ','bag',8),
  ('steel','Rebar SD295 6mm','ដែកគោល ៦ម.ម','piece',1),
  ('steel','Rebar SD295 9mm','ដែកគោល ៩ម.ម','piece',2),
  ('steel','Rebar SD295 12mm','ដែកគោល ១២ម.ម','piece',3),
  ('steel','Rebar SD390 16mm','ដែកគោល ១៦ម.ម','piece',4),
  ('steel','Steel wire mesh','សំណាញ់ដែក','sheet',5),
  ('steel','Binding wire','លួសចង','kg',6),
  ('steel','Square tube 40x40','ដែកប្រអប់ ៤០x៤០','piece',7),
  ('steel','I-beam','ដែក I','piece',8),
  ('steel','C-channel purlin','ដែក C','piece',9),
  ('bricks','Red clay brick','ឥដ្ឋដីឥដ្ឋ','piece',1),
  ('bricks','Hollow block 10cm','ប្លុក ១០ស.ម','piece',2),
  ('bricks','Hollow block 15cm','ប្លុក ១៥ស.ម','piece',3),
  ('bricks','Hollow block 20cm','ប្លុក ២០ស.ម','piece',4),
  ('bricks','AAC lightweight block','ប្លុកស្រាល AAC','piece',5),
  ('bricks','Paving block','ឥដ្ឋក្រាលផ្លូវ','piece',6),
  ('tiles','Floor tile 40x40','ឥដ្ឋក្រាល ៤០x៤០','box',1),
  ('tiles','Floor tile 60x60','ឥដ្ឋក្រាល ៦០x៦០','box',2),
  ('tiles','Wall tile 30x60','ឥដ្ឋជញ្ជាំង ៣០x៦០','box',3),
  ('tiles','Granite tile 80x80','ឥដ្ឋហ្គ្រានីត ៨០x៨០','box',4),
  ('tiles','Tile adhesive 25kg','កាវបិទឥដ្ឋ ២៥គីឡូ','bag',5),
  ('tiles','Tile grout 1kg','ស៊ីម៉ង់ត៍ចន្លោះឥដ្ឋ','bag',6),
  ('tiles','Vinyl / SPC flooring','ឥដ្ឋវីនីល SPC','m2',7),
  ('paint','Interior emulsion 20L','ថ្នាំលាបក្នុង ២០លីត្រ','bucket',1),
  ('paint','Exterior weather paint 20L','ថ្នាំលាបក្រៅ ២០លីត្រ','bucket',2),
  ('paint','Undercoat / primer 20L','ថ្នាំលាបគ្រឹះ ២០លីត្រ','bucket',3),
  ('paint','Wall putty 40kg','ម្សៅលាបជញ្ជាំង ៤០គីឡូ','bag',4),
  ('paint','Wood / metal enamel 3L','ថ្នាំលាបឈើដែក ៣លីត្រ','can',5),
  ('paint','Thinner 3L','ថ្នាំរំលាយ ៣លីត្រ','can',6),
  ('paint','Paint roller set','ឈុតរ៉ូឡូលាបថ្នាំ','set',7),
  ('paint','Paint brush','ជក់លាបថ្នាំ','piece',8),
  ('plumbing','PVC pipe 1/2"','បំពង់ PVC ១/២"','piece',1),
  ('plumbing','PVC pipe 3/4"','បំពង់ PVC ៣/៤"','piece',2),
  ('plumbing','PVC pipe 2"','បំពង់ PVC ២"','piece',3),
  ('plumbing','PVC pipe 4"','បំពង់ PVC ៤"','piece',4),
  ('plumbing','PPR hot water pipe','បំពង់ទឹកក្តៅ PPR','piece',5),
  ('plumbing','PVC elbow / tee fittings','ត្រង់កោង PVC','piece',6),
  ('plumbing','Ball valve','វ៉ាល់បិទបើក','piece',7),
  ('plumbing','Water tank 1000L','អាងទឹក ១០០០លីត្រ','piece',8),
  ('plumbing','Water pump','ម៉ាស៊ីនបូមទឹក','piece',9),
  ('plumbing','PVC glue','កាវ PVC','can',10),
  ('electrical','Electric cable 1.5mm','ខ្សែភ្លើង ១.៥ម.ម','roll',1),
  ('electrical','Electric cable 2.5mm','ខ្សែភ្លើង ២.៥ម.ម','roll',2),
  ('electrical','Electric cable 4mm','ខ្សែភ្លើង ៤ម.ម','roll',3),
  ('electrical','Conduit pipe 20mm','បំពង់ខ្សែភ្លើង ២០ម.ម','piece',4),
  ('electrical','Circuit breaker 32A','ប្រេកឃ័រ ៣២A','piece',5),
  ('electrical','Distribution box','ប្រអប់ចែកភ្លើង','piece',6),
  ('electrical','Wall switch','កុងតាក់ជញ្ជាំង','piece',7),
  ('electrical','Power socket','ព្រីភ្លើង','piece',8),
  ('electrical','LED bulb 9W','អំពូល LED ៩W','piece',9),
  ('electrical','LED tube light 1.2m','អំពូលបន្ទះ ១.២ម','piece',10),
  ('electrical','Ceiling fan','កង្ហារពិដាន','piece',11),
  ('roofing','Zinc sheet 0.30mm','ស័ង្កសី ០.៣០ម.ម','sheet',1),
  ('roofing','Zinc sheet 0.35mm','ស័ង្កសី ០.៣៥ម.ម','sheet',2),
  ('roofing','Color coated metal sheet','ស័ង្កសីពណ៌','sheet',3),
  ('roofing','Concrete roof tile','គ្រឿងដំបូលបេតុង','piece',4),
  ('roofing','Fibre cement roof sheet','បន្ទះដំបូលហ្វៃប៊ែរ','sheet',5),
  ('roofing','Roofing screw','ឡៅដំបូល','pack',6),
  ('roofing','Ridge cap','គ្របកំពូលដំបូល','piece',7),
  ('roofing','Insulation foil','សន្លឹកកំដៅ','roll',8),
  ('wood','Timber 2x4 (4m)','ឈើ ២x៤ (៤ម)','piece',1),
  ('wood','Timber 2x6 (4m)','ឈើ ២x៦ (៤ម)','piece',2),
  ('wood','Plywood 9mm','ក្តារបន្ទះ ៩ម.ម','sheet',3),
  ('wood','Plywood 15mm','ក្តារបន្ទះ ១៥ម.ម','sheet',4),
  ('wood','Formwork plywood','ក្តារពុម្ពបេតុង','sheet',5),
  ('wood','MDF board','ក្តារ MDF','sheet',6),
  ('wood','Gypsum board 9mm','ក្តារកំបោរ ៩ម.ម','sheet',7),
  ('wood','Metal stud frame','ស៊ុមដែកពិដាន','piece',8),
  ('hardware','Nails 3"','ដែកគោល ៣"','kg',1),
  ('hardware','Screws pack','ឡៅមួយកញ្ចប់','pack',2),
  ('hardware','Hammer','ញញួរ','piece',3),
  ('hardware','Hand saw','រណារដៃ','piece',4),
  ('hardware','Measuring tape 5m','មែត្រវាស់ ៥ម','piece',5),
  ('hardware','Spirit level','នីវ៉ូ','piece',6),
  ('hardware','Trowel','ស្លាបព្រាបាយអ','piece',7),
  ('hardware','Wheelbarrow','រទេះរុញ','piece',8),
  ('hardware','Angle grinder','ម៉ាស៊ីនកិន','piece',9),
  ('hardware','Electric drill','ម៉ាស៊ីនស្នោ','piece',10),
  ('hardware','Safety helmet','មួកសុវត្ថិភាព','piece',11),
  ('hardware','Work gloves','ស្រោមដៃ','pair',12),
  ('sanitary','Toilet bowl set','ឈុតបង្គន់','set',1),
  ('sanitary','Wash basin','អាងលាងដៃ','piece',2),
  ('sanitary','Shower set','ឈុតផ្កាឈូក','set',3),
  ('sanitary','Kitchen sink','អាងលាងចាន','piece',4),
  ('sanitary','Floor drain','ច្រកបង្ហូរទឹក','piece',5),
  ('glass_aluminum','Aluminium window frame','ស៊ុមបង្អួចអាលុយ','m2',1),
  ('glass_aluminum','Clear glass 5mm','កញ្ចក់ថ្លា ៥ម.ម','m2',2),
  ('glass_aluminum','Tempered glass 10mm','កញ្ចក់ស្វិត ១០ម.ម','m2',3),
  ('doors_windows','Steel door','ទ្វារដែក','piece',1),
  ('doors_windows','Wooden door','ទ្វារឈើ','piece',2),
  ('doors_windows','PVC bathroom door','ទ្វារបង្គន់ PVC','piece',3),
  ('doors_windows','Door lock set','ឈុតសោទ្វារ','set',4)
) AS v(cat_code, name_en, name_km, unit, sort_order)
JOIN public.supplier_categories c ON c.code = v.cat_code;