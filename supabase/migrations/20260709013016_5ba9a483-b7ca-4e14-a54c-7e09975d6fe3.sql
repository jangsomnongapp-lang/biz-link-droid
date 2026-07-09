create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null,
  name_km text not null,
  description_en text,
  description_km text,
  sort_order int not null default 0
);

comment on table public.blog_categories is 'Fixed taxonomy for BuildHub blog posts';

grant select on public.blog_categories to anon, authenticated;
grant all on public.blog_categories to service_role;

alter table public.blog_categories enable row level security;

create policy "blog_categories public read"
  on public.blog_categories
  for select
  to anon, authenticated
  using (true);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category_id uuid not null references public.blog_categories(id) on delete restrict,
  title text not null,
  excerpt text,
  content text not null,
  cover_image_url text,
  author_name text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  meta_title text,
  meta_description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.blog_posts is 'BuildHub blog articles for SEO and content marketing';

grant select on public.blog_posts to anon, authenticated;
grant all on public.blog_posts to service_role;

alter table public.blog_posts enable row level security;

create policy "blog_published_posts public read"
  on public.blog_posts
  for select
  to anon, authenticated
  using (status = 'published');

-- Insert categories
insert into public.blog_categories (slug, name_en, name_km, sort_order) values
  ('construction-tips', 'Construction Tips', 'គន្លឹះសាងសង់', 1),
  ('materials-guide', 'Materials Guide', 'វិធីសាស្រ្តវត្ថុធាតុដើម', 2),
  ('equipment', 'Equipment', 'ឧបករណ៍', 3),
  ('home-renovation', 'Home Renovation', 'កែប្រែផ្ទះ', 4),
  ('market-news', 'Market News', 'ព័ត៌មានទីផ្សារ', 5),
  ('safety', 'Safety', 'សុវត្ថិភាព', 6),
  ('project-case-studies', 'Project Case Studies', 'ករណីគម្រោង', 7)
on conflict (slug) do nothing;

-- Seed starter posts
with cats as (
  select id, slug from public.blog_categories
),
existing as (
  select 1 as x from public.blog_posts where slug = 'how-to-choose-cement-for-home-construction'
)
insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'how-to-choose-cement-for-home-construction',
  cats.id,
  'How to Choose Cement for Home Construction in Cambodia',
  'Picking the right cement type saves money and prevents cracks. Learn which cement grade to use for footings, columns, and finishing in Cambodia’s tropical climate.',
  E'## Why cement choice matters\n\nCement is the glue of every concrete mix. In Cambodia’s hot, humid climate — with monsoon rain and seasonal flooding — the wrong cement grade can lead to cracks, efflorescence, and early structural failure.\n\n## Common cement types in Cambodia\n\n- **Ordinary Portland Cement (OPC) 33R / 43R** – General finishing and non-structural work.\n- **Portland Cement 53R** – Higher strength for columns, beams, and footings.\n- **Blended cements (PPC)** – Better sulphate resistance and lower heat; useful for underground work and plaster.\n\n## What to buy for each part of the house\n\n| Application | Recommended grade | Notes |\n|-------------|-------------------|-------|\n| Footings & foundation | 53R or PPC | High strength, moisture resistance |\n| Columns & beams | 53R | Carries load; follow engineer spec |\n| Plaster & finishing | 33R–43R | Smooth finish, easier to work |\n| External walls & water tanks | PPC | Sulphate resistance |\n\n## Quick checks before buying\n\n1. Look for the **IS/EN standard** or local quality mark on the bag.\n2. Check the **manufacturing date** — cement loses strength after 3 months.\n3. Avoid bags that are **clumped or damp**.\n4. Ask your contractor for the **engineer’s specification** rather than letting the shop decide.\n\n## Where to buy\n\nBuildHub connects you with verified suppliers across Cambodia. Browse the supplier directory or post a material request to get quotes from multiple vendors.',
  'BuildHub Editorial',
  'published',
  now(),
  'How to Choose Cement for Home Construction in Cambodia — BuildHub',
  'Picking the right cement type saves money and prevents cracks. Learn which cement grade to use for footings, columns, and finishing in Cambodia.'
from cats, existing
where cats.slug = 'materials-guide' and existing.x is null;

with cats as (
  select id, slug from public.blog_categories
),
existing as (
  select 1 as x from public.blog_posts where slug = 'construction-cost-cambodia-2026'
)
insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'construction-cost-cambodia-2026',
  cats.id,
  'Construction Cost in Cambodia: 2026 Guide',
  'Plan your budget with current construction prices per square metre in Phnom Penh, Siem Reap, and Sihanoukville for residential and commercial projects.',
  E'## Construction cost per square metre (2026)\n\nCosts vary by city, finish quality, and project complexity. The figures below are typical ranges for Cambodia in 2026.\n\n| Build type | USD / m² | Notes |\n|------------|----------|-------|\n| Basic residential | $450 – $700 | Minimal finishes, local materials |\n| Mid-range residential | $700 – $1,100 | Tile, aluminium, decent fixtures |\n| High-end residential | $1,100 – $1,800 | Imported materials, full MEP design |\n| Commercial / office | $900 – $1,500 | Façade and fire-safety extras |\n| Industrial / warehouse | $350 – $650 | Shell only, large spans |\n\n## City differences\n\n- **Phnom Penh** – Highest labour and material costs, but best supplier choice.\n- **Siem Reap** – Moderate costs; strong tourism-driven finish-quality options.\n- **Sihanoukville** – Variable due to logistics; coastal corrosion can increase steel and concrete specs.\n\n## What drives cost changes in 2026\n\n1. Steel and cement price fluctuations.\n2. Labour shortages in skilled trades.\n3. Transport costs for remote provinces.\n4. New permit and compliance requirements from MLMUPC.\n\n## How to control your budget\n\n- Get **three quotes** from contractors or crews.\n- Use BuildHub’s **Find a Worker** and **Find Material** tools to compare rates.\n- Lock in **material prices** early if the project timeline is long.\n- Keep a **10–15% contingency** for unseen ground conditions and design changes.',
  'BuildHub Editorial',
  'published',
  now(),
  'Construction Cost in Cambodia: 2026 Guide — BuildHub',
  'Plan your budget with current construction prices per square metre in Phnom Penh, Siem Reap, and Sihanoukville for residential and commercial projects.'
from cats, existing
where cats.slug = 'market-news' and existing.x is null;

with cats as (
  select id, slug from public.blog_categories
),
existing as (
  select 1 as x from public.blog_posts where slug = 'construction-safety-rules-cambodia'
)
insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'construction-safety-rules-cambodia',
  cats.id,
  '5 Construction Safety Rules Every Site in Cambodia Should Follow',
  'Avoid fines and injuries with these practical safety habits for small and mid-sized Cambodian construction sites.',
  E'## Why safety matters on Cambodian sites\n\nConstruction is one of the riskiest industries in Cambodia. Small sites often skip basic safety to save time, but accidents delay projects and can lead to legal liability.\n\n## 1. Wear basic PPE\n\nEvery worker should have a hard hat, gloves, and closed-toe shoes. Sites with scaffolding or excavation should add harnesses and steel-toe boots.\n\n## 2. Secure trenches and excavations\n\nCambodia’s rainy season can collapse open trenches quickly. Shoring, sloping, or benching is essential for any trench deeper than 1.2 metres.\n\n## 3. Use temporary electrical protection\n\n- GFCI/RCD protection for power tools.\n- Elevated cables away from water and foot traffic.\n- Qualified electrician for temporary boards.\n\n## 4. Keep the site clear of debris\n\nTrips, falls, and nail injuries are common. A 10-minute daily cleanup routine prevents most of them.\n\n## 5. Train workers before they start\n\nEven a short 15-minute briefing on site hazards, emergency contacts, and tool use reduces incident rates.\n\n## BuildHub can help\n\nPost a safety consultant or experienced foreman role on BuildHub to bring a safety-first culture to your next project.',
  'BuildHub Editorial',
  'published',
  now(),
  '5 Construction Safety Rules Every Site in Cambodia Should Follow — BuildHub',
  'Avoid fines and injuries with these practical safety habits for small and mid-sized Cambodian construction sites.'
from cats, existing
where cats.slug = 'safety' and existing.x is null;

with cats as (
  select id, slug from public.blog_categories
),
existing as (
  select 1 as x from public.blog_posts where slug = 'small-home-renovation-tips-cambodia'
)
insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'small-home-renovation-tips-cambodia',
  cats.id,
  'Small Home Renovation Tips That Add Value in Cambodia',
  'Affordable upgrades that improve comfort, rental value, and resale value for homes in Phnom Penh and Siem Reap.',
  E'## Renovations that pay back\n\nNot every upgrade is worth the cost. In Cambodia’s market, focus on changes that improve daily living and appeal to future buyers or tenants.\n\n## 1. Waterproof bathrooms and kitchens\n\nLeaks are the most common renovation regret. Use proper waterproofing membranes and slope floors to drains.\n\n## 2. Upgrade electrical capacity\n\nOlder homes often have 10–20 amp service. Add circuits for air conditioning, water heaters, and modern appliances.\n\n## 3. Improve natural ventilation\n\nCross-ventilation reduces air-con bills. Consider larger windows, vents, and open stairwells where security allows.\n\n## 4. Tile and paint for quick refresh\n\nFresh paint and quality tile deliver the biggest visual impact per dollar. Choose light colours to make rooms feel larger.\n\n## 5. Add storage\n\nBuilt-in cabinets, shelves, and parking space increase usable value without expanding the footprint.\n\n## Find renovation help\n\nUse BuildHub to find electricians, tilers, painters, and renovation crews near you.',
  'BuildHub Editorial',
  'published',
  now(),
  'Small Home Renovation Tips That Add Value in Cambodia — BuildHub',
  'Affordable upgrades that improve comfort, rental value, and resale value for homes in Phnom Penh and Siem Reap.'
from cats, existing
where cats.slug = 'home-renovation' and existing.x is null;
