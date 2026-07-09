-- Insert starter blog posts using proper category lookups
insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'how-to-choose-cement-for-home-construction',
  c.id,
  'How to Choose Cement for Home Construction in Cambodia',
  'Picking the right cement type saves money and prevents cracks. Learn which cement grade to use for footings, columns, and finishing in Cambodia’s tropical climate.',
  E'## Why cement choice matters\n\nCement is the glue of every concrete mix. In Cambodia’s hot, humid climate — with monsoon rain and seasonal flooding — the wrong cement grade can lead to cracks, efflorescence, and early structural failure.\n\n## Common cement types in Cambodia\n\n- **Ordinary Portland Cement (OPC) 33R / 43R** – General finishing and non-structural work.\n- **Portland Cement 53R** – Higher strength for columns, beams, and footings.\n- **Blended cements (PPC)** – Better sulphate resistance and lower heat; useful for underground work and plaster.\n\n## What to buy for each part of the house\n\n| Application | Recommended grade | Notes |\n|-------------|-------------------|-------|\n| Footings & foundation | 53R or PPC | High strength, moisture resistance |\n| Columns & beams | 53R | Carries load; follow engineer spec |\n| Plaster & finishing | 33R–43R | Smooth finish, easier to work |\n| External walls & water tanks | PPC | Sulphate resistance |\n\n## Quick checks before buying\n\n1. Look for the **IS/EN standard** or local quality mark on the bag.\n2. Check the **manufacturing date** — cement loses strength after 3 months.\n3. Avoid bags that are **clumped or damp**.\n4. Ask your contractor for the **engineer’s specification** rather than letting the shop decide.\n\n## Where to buy\n\nBuildHub connects you with verified suppliers across Cambodia. Browse the supplier directory or post a material request to get quotes from multiple vendors.',
  'BuildHub Editorial',
  'published',
  now(),
  'How to Choose Cement for Home Construction in Cambodia — BuildHub',
  'Picking the right cement type saves money and prevents cracks. Learn which cement grade to use for footings, columns, and finishing in Cambodia.'
from public.blog_categories c
where c.slug = 'materials-guide'
  and not exists (select 1 from public.blog_posts where slug = 'how-to-choose-cement-for-home-construction');

insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'construction-cost-cambodia-2026',
  c.id,
  'Construction Cost in Cambodia: 2026 Guide',
  'Plan your budget with current construction prices per square metre in Phnom Penh, Siem Reap, and Sihanoukville for residential and commercial projects.',
  E'## Construction cost per square metre (2026)\n\nCosts vary by city, finish quality, and project complexity. The figures below are typical ranges for Cambodia in 2026.\n\n| Build type | USD / m² | Notes |\n|------------|----------|-------|\n| Basic residential | $450 – $700 | Minimal finishes, local materials |\n| Mid-range residential | $700 – $1,100 | Tile, aluminium, decent fixtures |\n| High-end residential | $1,100 – $1,800 | Imported materials, full MEP design |\n| Commercial / office | $900 – $1,500 | Façade and fire-safety extras |\n| Industrial / warehouse | $350 – $650 | Shell only, large spans |\n\n## City differences\n\n- **Phnom Penh** – Highest labour and material costs, but best supplier choice.\n- **Siem Reap** – Moderate costs; strong tourism-driven finish-quality options.\n- **Sihanoukville** – Variable due to logistics; coastal corrosion can increase steel and concrete specs.\n\n## What drives cost changes in 2026\n\n1. Steel and cement price fluctuations.\n2. Labour shortages in skilled trades.\n3. Transport costs for remote provinces.\n4. New permit and compliance requirements from MLMUPC.\n\n## How to control your budget\n\n- Get **three quotes** from contractors or crews.\n- Use BuildHub’s **Find a Worker** and **Find Material** tools to compare rates.\n- Lock in **material prices** early if the project timeline is long.\n- Keep a **10–15% contingency** for unseen ground conditions and design changes.',
  'BuildHub Editorial',
  'published',
  now(),
  'Construction Cost in Cambodia: 2026 Guide — BuildHub',
  'Plan your budget with current construction prices per square metre in Phnom Penh, Siem Reap, and Sihanoukville for residential and commercial projects.'
from public.blog_categories c
where c.slug = 'market-news'
  and not exists (select 1 from public.blog_posts where slug = 'construction-cost-cambodia-2026');

insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'construction-safety-rules-cambodia',
  c.id,
  '5 Construction Safety Rules Every Site in Cambodia Should Follow',
  'Avoid fines and injuries with these practical safety habits for small and mid-sized Cambodian construction sites.',
  E'## Why safety matters on Cambodian sites\n\nConstruction is one of the riskiest industries in Cambodia. Small sites often skip basic safety to save time, but accidents delay projects and can lead to legal liability.\n\n## 1. Wear basic PPE\n\nEvery worker should have a hard hat, gloves, and closed-toe shoes. Sites with scaffolding or excavation should add harnesses and steel-toe boots.\n\n## 2. Secure trenches and excavations\n\nCambodia’s rainy season can collapse open trenches quickly. Shoring, sloping, or benching is essential for any trench deeper than 1.2 metres.\n\n## 3. Use temporary electrical protection\n\n- GFCI/RCD protection for power tools.\n- Elevated cables away from water and foot traffic.\n- Qualified electrician for temporary boards.\n\n## 4. Keep the site clear of debris\n\nTrips, falls, and nail injuries are common. A 10-minute daily cleanup routine prevents most of them.\n\n## 5. Train workers before they start\n\nEven a short 15-minute briefing on site hazards, emergency contacts, and tool use reduces incident rates.\n\n## BuildHub can help\n\nPost a safety consultant or experienced foreman role on BuildHub to bring a safety-first culture to your next project.',
  'BuildHub Editorial',
  'published',
  now(),
  '5 Construction Safety Rules Every Site in Cambodia Should Follow — BuildHub',
  'Avoid fines and injuries with these practical safety habits for small and mid-sized Cambodian construction sites.'
from public.blog_categories c
where c.slug = 'safety'
  and not exists (select 1 from public.blog_posts where slug = 'construction-safety-rules-cambodia');

insert into public.blog_posts (
  slug, category_id, title, excerpt, content, author_name, status, published_at, meta_title, meta_description
)
select
  'small-home-renovation-tips-cambodia',
  c.id,
  'Small Home Renovation Tips That Add Value in Cambodia',
  'Affordable upgrades that improve comfort, rental value, and resale value for homes in Phnom Penh and Siem Reap.',
  E'## Renovations that pay back\n\nNot every upgrade is worth the cost. In Cambodia’s market, focus on changes that improve daily living and appeal to future buyers or tenants.\n\n## 1. Waterproof bathrooms and kitchens\n\nLeaks are the most common renovation regret. Use proper waterproofing membranes and slope floors to drains.\n\n## 2. Upgrade electrical capacity\n\nOlder homes often have 10–20 amp service. Add circuits for air conditioning, water heaters, and modern appliances.\n\n## 3. Improve natural ventilation\n\nCross-ventilation reduces air-con bills. Consider larger windows, vents, and open stairwells where security allows.\n\n## 4. Tile and paint for quick refresh\n\nFresh paint and quality tile deliver the biggest visual impact per dollar. Choose light colours to make rooms feel larger.\n\n## 5. Add storage\n\nBuilt-in cabinets, shelves, and parking space increase usable value without expanding the footprint.\n\n## Find renovation help\n\nUse BuildHub to find electricians, tilers, painters, and renovation crews near you.',
  'BuildHub Editorial',
  'published',
  now(),
  'Small Home Renovation Tips That Add Value in Cambodia — BuildHub',
  'Affordable upgrades that improve comfort, rental value, and resale value for homes in Phnom Penh and Siem Reap.'
from public.blog_categories c
where c.slug = 'home-renovation'
  and not exists (select 1 from public.blog_posts where slug = 'small-home-renovation-tips-cambodia');
