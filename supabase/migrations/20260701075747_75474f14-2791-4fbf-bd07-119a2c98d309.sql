
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

grant select, insert, update, delete on public.device_tokens to authenticated;
grant all on public.device_tokens to service_role;

alter table public.device_tokens enable row level security;

create policy "users select own device tokens" on public.device_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "users insert own device tokens" on public.device_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "users update own device tokens" on public.device_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own device tokens" on public.device_tokens
  for delete to authenticated using (user_id = auth.uid());
