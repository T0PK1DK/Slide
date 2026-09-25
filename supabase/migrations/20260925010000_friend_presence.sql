-- Friends on the map ("presence"), privacy-first:
--   * Off by default; a driver turns it on in Profile and can stop with one tap.
--   * The SERVER rounds every position to 2 decimals (~1 km) before storing it,
--     so no client — even a modified one — can publish a precise location.
--   * Only mutual friends (you follow each other) can read it; followers can't.
--   * Positions older than 15 minutes are never returned, and stopping deletes the row.
--   * The app never shows friends while you're driving (client rule, HANDOFF).

create table public.presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  updated_at timestamptz not null default now()
);
-- No policies on purpose: reads and writes go through the functions below.
alter table public.presence enable row level security;

create function public.share_presence(p_lat double precision, p_lon double precision)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to share' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Create your driver profile first' using errcode = '28000';
  end if;
  insert into public.presence (user_id, lat, lon, updated_at)
  values (auth.uid(), round(p_lat::numeric, 2)::double precision, round(p_lon::numeric, 2)::double precision, now())
  on conflict (user_id) do update set lat = excluded.lat, lon = excluded.lon, updated_at = now();
end
$$;

create function public.stop_presence()
returns void
language sql security definer set search_path = '' as $$
  delete from public.presence where user_id = auth.uid();
$$;

-- Mutual friends who shared in the last 15 minutes. Rough positions only.
create function public.friends_presence()
returns table (id uuid, handle text, display_name text, car_tag text, lat double precision, lon double precision, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.car_tag, pr.lat, pr.lon, pr.updated_at
  from public.follows a
  join public.follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
  join public.presence pr on pr.user_id = a.followee_id
  join public.profiles p on p.id = a.followee_id
  where a.follower_id = auth.uid() and pr.updated_at > now() - interval '15 minutes'
  order by pr.updated_at desc
  limit 100
$$;

revoke all on function public.share_presence(double precision, double precision) from public, anon;
revoke all on function public.stop_presence() from public, anon;
revoke all on function public.friends_presence() from public, anon;
grant execute on function public.share_presence(double precision, double precision) to authenticated;
grant execute on function public.stop_presence() to authenticated;
grant execute on function public.friends_presence() to authenticated;
