create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  media_url text not null,
  media_type text not null default 'photo' check (media_type in ('photo','video')),
  caption text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index stories_active_idx on public.stories(expires_at, status);
create index stories_user_idx on public.stories(user_id);

alter table public.stories enable row level security;

create policy "approved active stories readable by auth"
on public.stories for select to authenticated
using (
  (status = 'approved' and expires_at > now())
  or auth.uid() = user_id
  or public.is_admin(auth.uid())
);

create policy "users insert own stories"
on public.stories for insert to authenticated
with check (auth.uid() = user_id);

create policy "users update own stories"
on public.stories for update to authenticated
using (auth.uid() = user_id);

create policy "admins update stories"
on public.stories for update to authenticated
using (public.is_admin(auth.uid()));

create policy "admins delete stories"
on public.stories for delete to authenticated
using (public.is_admin(auth.uid()));
