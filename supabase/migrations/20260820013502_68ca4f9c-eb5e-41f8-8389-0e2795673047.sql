insert into public.catalog_products (category_id, name_en, name_km, unit, sort_order, is_active, market_currency)
select c.id, v.name_en, v.name_km, v.unit, v.so, true, 'USD'
from public.supplier_categories c
join (values
  ('other','Waterproofing Membrane','ក្រណាត់ការពារទឹក','roll',1),
  ('other','Silicone Sealant','កាវស៊ីលីខូន','tube',2),
  ('other','Construction Adhesive','កាវសំណង់','tube',3),
  ('other','Insulation Foam','សន្លឹកកាត់កម្ដៅ','sheet',4),
  ('other','Geotextile Fabric','ក្រណាត់ដីវិទ្យា','roll',5),
  ('other','Safety Equipment Set','សម្ភារៈសុវត្ថិភាព','set',6),
  ('other','Scaffolding Frame','ស៊ុមរាន','piece',7),
  ('other','Wire Mesh','សំណាញ់លួស','sheet',8),
  ('machinery','Concrete Mixer','ម៉ាស៊ីនលាយបេតុង','day',1),
  ('machinery','Excavator','ម៉ាស៊ីនកាយដី','day',2),
  ('machinery','Vibrator Poker','ម៉ាស៊ីនរំញ័របេតុង','day',3),
  ('machinery','Generator','ម៉ាស៊ីនភ្លើង','day',4),
  ('machinery','Water Pump','ម៉ាស៊ីនបូមទឹក','day',5),
  ('machinery','Scaffolding Set','សំណុំរាន','day',6),
  ('furniture','Kitchen Cabinet','ទូបាយ','set',1),
  ('furniture','Wardrobe','ទូដាក់សម្លៀកបំពាក់','piece',2),
  ('furniture','Ceiling Fan','កង្ហារពិដាន','piece',3),
  ('furniture','Curtain Rail','ដងវាំងនន','piece',4),
  ('furniture','Door Handle Set','សំណុំដៃទ្វារ','set',5),
  ('furniture','Cabinet Hinges','កាន់ជាប់ទូ','pack',6)
) as v(code,name_en,name_km,unit,so) on v.code = c.code
where not exists (
  select 1 from public.catalog_products p where p.category_id = c.id and p.name_en = v.name_en
);