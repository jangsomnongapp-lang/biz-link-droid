INSERT INTO public.supplier_categories (code, name_en, name_km, sort_order, is_active) VALUES
('cement','Cement & Concrete','ស៊ីម៉ង់ត៍ និងបេតុង',1,true),
('steel','Steel & Rebar','ដែក និងដែកពង្រឹង',2,true),
('bricks','Bricks & Blocks','ឥដ្ឋ និងប្លុក',3,true),
('tiles','Tiles & Flooring','កំបោរឥដ្ឋ និងឥដ្ឋឥដ្ឋា',4,true),
('paint','Paint & Coatings','ថ្នាំលាប',5,true),
('plumbing','Plumbing & Pipes','បង្ហូរទឹក និងបំពង់',6,true),
('electrical','Electrical Supplies','សម្ភារៈអគ្គិសនី',7,true),
('roofing','Roofing Materials','សម្ភារៈដំបូល',8,true),
('wood','Wood & Timber','ឈើ',9,true),
('glass_aluminum','Glass & Aluminum','កញ្ចក់ និងអាលុយមីញ៉ូម',10,true),
('doors_windows','Doors & Windows','ទ្វារ និងបង្អួច',11,true),
('sanitary','Sanitary Ware','សម្ភារៈបង្គន់',12,true),
('hardware','Hardware & Tools','ឧបករណ៍ និងសម្ភារៈ',13,true),
('machinery','Machinery Rental','ជួលគ្រឿងចក្រ',14,true),
('other','Other Materials','សម្ភារៈផ្សេងៗ',15,true)
ON CONFLICT (code) DO NOTHING;