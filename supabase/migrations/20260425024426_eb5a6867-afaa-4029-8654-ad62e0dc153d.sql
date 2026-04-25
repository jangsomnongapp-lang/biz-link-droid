
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  full_name text,
  avatar_url text,
  about_me text,
  is_provider boolean not null default false,
  is_coordinator boolean not null default false,
  is_organization boolean not null default false,
  is_client boolean not null default false,
  is_admin boolean not null default false,
  language text not null default 'km',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles are viewable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile + apply metadata on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, is_provider, is_coordinator, is_organization, is_client, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    coalesce((new.raw_user_meta_data->>'is_provider')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_coordinator')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_organization')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_client')::boolean, false),
    coalesce(new.raw_user_meta_data->>'language', 'km')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_km text not null,
  group_en text not null,
  group_km text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "categories readable by all auth"
  on public.categories for select to authenticated using (true);

insert into public.categories (code, name_en, name_km, group_en, group_km, sort_order) values
  ('A1','Bricklayer','ជាងឥដ្ឋ','Structure','រចនាសម្ព័ន្ធ',1),
  ('A2','Formwork','ជាងពុម្ព','Structure','រចនាសម្ព័ន្ធ',2),
  ('A3','Steel fixer','ជាងដែក','Structure','រចនាសម្ព័ន្ធ',3),
  ('A4','Machinery operator','អ្នកបើកម៉ាស៊ីន','Structure','រចនាសម្ព័ន្ធ',4),
  ('B1','Electrician','ជាងអគ្គិសនី','Installations','ការដំឡើង',5),
  ('B2','Plumber','ជាងបំពង់ទឹក','Installations','ការដំឡើង',6),
  ('B3','AC & Ventilation','ម៉ាស៊ីនត្រជាក់','Installations','ការដំឡើង',7),
  ('B4','Welder','ជាងផ្សារ','Installations','ការដំឡើង',8),
  ('C1','Painter','ជាងលាបថ្នាំ','Finishing','ការបញ្ចប់',9),
  ('C2','Tiler','ជាងក្បឿង','Finishing','ការបញ្ចប់',10),
  ('C3','Carpenter','ជាងឈើ','Finishing','ការបញ្ចប់',11),
  ('D1','Roofer','ជាងដំបូល','Other','ផ្សេងៗ',12),
  ('D2','Landscaper','ជាងសួនច្បារ','Other','ផ្សេងៗ',13),
  ('D3','Glass & aluminum installer','ជាងកញ្ចក់','Other','ផ្សេងៗ',14),
  ('D4','Other','ផ្សេងទៀត','Other','ផ្សេងៗ',15);

-- USER CATEGORIES
create table public.user_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, category_id)
);
alter table public.user_categories enable row level security;
create policy "user_categories readable by auth"
  on public.user_categories for select to authenticated using (true);
create policy "users manage own categories"
  on public.user_categories for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- LISTINGS
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  budget numeric,
  location text,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.listings enable row level security;
create policy "listings readable by auth"
  on public.listings for select to authenticated using (true);
create policy "users insert own listings"
  on public.listings for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own listings"
  on public.listings for update to authenticated using (auth.uid() = user_id);
create policy "users delete own listings"
  on public.listings for delete to authenticated using (auth.uid() = user_id);
create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- LISTING CATEGORIES
create table public.listing_categories (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  unique(listing_id, category_id)
);
alter table public.listing_categories enable row level security;
create policy "listing_cats readable by auth"
  on public.listing_categories for select to authenticated using (true);
create policy "owners manage listing_cats"
  on public.listing_categories for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()));

-- LISTING PHOTOS
create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);
alter table public.listing_photos enable row level security;
create policy "listing_photos readable"
  on public.listing_photos for select to authenticated using (true);
create policy "owners manage listing_photos"
  on public.listing_photos for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()));

-- APPLICATIONS
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique(listing_id, applicant_id)
);
alter table public.applications enable row level security;
create policy "applicants and owners read applications"
  on public.applications for select to authenticated
  using (
    auth.uid() = applicant_id
    or exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  );
create policy "users insert own applications"
  on public.applications for insert to authenticated with check (auth.uid() = applicant_id);
create policy "owners update applications"
  on public.applications for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()));

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  video_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "approved posts readable by auth"
  on public.posts for select to authenticated
  using (status = 'approved' or auth.uid() = user_id);
create policy "users insert own posts"
  on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own posts"
  on public.posts for update to authenticated using (auth.uid() = user_id);
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- POST PHOTOS
create table public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);
alter table public.post_photos enable row level security;
create policy "post_photos readable"
  on public.post_photos for select to authenticated using (true);
create policy "owners manage post_photos"
  on public.post_photos for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- PORTFOLIO PHOTOS
create table public.portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);
alter table public.portfolio_photos enable row level security;
create policy "portfolio readable by auth"
  on public.portfolio_photos for select to authenticated using (true);
create policy "users manage own portfolio"
  on public.portfolio_photos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
