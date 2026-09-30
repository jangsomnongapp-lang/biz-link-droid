create or replace function public.get_today_availability_bulk(_uids uuid[])
returns table (user_id uuid, status text)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, a.status
  from public.daily_availability a
  where a.user_id = any(_uids) and a.date = CURRENT_DATE;
$$;

revoke execute on function public.get_today_availability_bulk(uuid[]) from anon;
grant execute on function public.get_today_availability_bulk(uuid[]) to authenticated;