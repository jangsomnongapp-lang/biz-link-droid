-- Threads
create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles(id) on delete cascade,
  participant_b uuid not null references public.profiles(id) on delete cascade,
  last_message text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint participants_ordered check (participant_a < participant_b),
  unique (participant_a, participant_b)
);

alter table public.message_threads enable row level security;

create policy "participants read threads" on public.message_threads
  for select to authenticated
  using (auth.uid() = participant_a or auth.uid() = participant_b);

create policy "users create threads they are part of" on public.message_threads
  for insert to authenticated
  with check (auth.uid() = participant_a or auth.uid() = participant_b);

create policy "participants update threads" on public.message_threads
  for update to authenticated
  using (auth.uid() = participant_a or auth.uid() = participant_b);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_id_created_at_idx on public.messages (thread_id, created_at);

alter table public.messages enable row level security;

create policy "thread participants read messages" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.message_threads t
    where t.id = messages.thread_id
      and (auth.uid() = t.participant_a or auth.uid() = t.participant_b)
  ));

create policy "thread participants insert messages" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and (auth.uid() = t.participant_a or auth.uid() = t.participant_b)
    )
  );

create policy "recipients mark read" on public.messages
  for update to authenticated
  using (exists (
    select 1 from public.message_threads t
    where t.id = messages.thread_id
      and (auth.uid() = t.participant_a or auth.uid() = t.participant_b)
  ));

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  related_user_id uuid references public.profiles(id) on delete set null,
  related_listing_id uuid references public.listings(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "users read own notifications" on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

create policy "users update own notifications" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id);

create policy "users delete own notifications" on public.notifications
  for delete to authenticated
  using (auth.uid() = user_id);

-- Helper: keep thread last_message updated
create or replace function public.bump_thread_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.message_threads
    set last_message = new.content,
        last_message_at = new.created_at
    where id = new.thread_id;
  return new;
end;
$$;

create trigger messages_bump_thread
after insert on public.messages
for each row execute function public.bump_thread_on_message();