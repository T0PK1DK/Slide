-- Slide: accounts, profiles, follows, and driver reports for the radar.
--
-- Privacy rules (docs/STRATEGY.md, HANDOFF.md):
--   * A report never reveals who made it. `reports` has no read policy; reads go
--     through reports_near(), which returns no reporter column.
--   * Follows are visible only to the two people in them.
--   * Your drives, places and trip history are NOT stored here — they stay on the phone.
--   * Deleting your account removes your profile, follows, reports and votes.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 24),
  car_tag text check (char_length(car_tag) <= 10),
  -- Only filled when the driver opts to show their car ("2023 Tesla Model 3").
  car_label text check (char_length(car_label) <= 60),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Signed-in drivers can read profiles" on public.profiles
  for select to authenticated using (true);
create policy "Drivers create their own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Drivers edit their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ----------------------------------------------------------------- follows
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;

create policy "See follows you are part of" on public.follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
create policy "Follow as yourself" on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "Unfollow, or remove a follower" on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- ----------------------------------------------------------------- reports
create type public.report_kind as enum ('police', 'crash', 'hazard', 'closure', 'jam');

create table public.reports (
  id bigint generated always as identity primary key,
  kind public.report_kind not null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  heading smallint check (heading between 0 and 359),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirms integer not null default 0,
  clears integer not null default 0
);
create index reports_live_idx on public.reports (expires_at, lat, lon);
create index reports_reporter_idx on public.reports (reporter_id, created_at);
-- No policies on purpose: every read and write goes through the functions below.
alter table public.reports enable row level security;

create table public.report_votes (
  report_id bigint not null references public.reports (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  still_there boolean not null,
  created_at timestamptz not null default now(),
  primary key (report_id, voter_id)
);
create index report_votes_voter_idx on public.report_votes (voter_id);
alter table public.report_votes enable row level security;

-- How long a fresh or confirmed report stays on the radar.
create function public.report_ttl(k public.report_kind)
returns interval language sql immutable set search_path = '' as $$
  select case k
    when 'police' then interval '30 minutes'
    when 'crash' then interval '60 minutes'
    when 'closure' then interval '120 minutes'
    when 'jam' then interval '20 minutes'
    else interval '45 minutes'
  end
$$;

-- Live reports in a box around a point. No reporter column, ever.
create function public.reports_near(p_lat double precision, p_lon double precision, p_km double precision default 8)
returns table (
  id bigint, kind public.report_kind, lat double precision, lon double precision, heading smallint,
  created_at timestamptz, expires_at timestamptz, confirms integer, clears integer
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.kind, r.lat, r.lon, r.heading, r.created_at, r.expires_at, r.confirms, r.clears
  from public.reports r
  where r.expires_at > now()
    and r.lat between p_lat - least(p_km, 50) / 111.0 and p_lat + least(p_km, 50) / 111.0
    and r.lon between p_lon - least(p_km, 50) / (111.0 * cos(radians(p_lat)))
                  and p_lon + least(p_km, 50) / (111.0 * cos(radians(p_lat)))
  order by r.created_at desc
  limit 200
$$;

-- File a report at the driver's position. Signed-in only, rate-limited, and a
-- same-kind report within ~150 m in the last 10 minutes counts as a confirm.
create function public.submit_report(p_kind public.report_kind, p_lat double precision, p_lon double precision, p_heading smallint default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  existing bigint;
  new_id bigint;
begin
  if uid is null then raise exception 'Sign in to report' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'Create your driver profile first' using errcode = '28000';
  end if;
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many reports — try again in a few minutes' using errcode = '54000';
  end if;
  select r.id into existing from public.reports r
  where r.kind = p_kind and r.expires_at > now() and r.created_at > now() - interval '10 minutes'
    and abs(r.lat - p_lat) < 0.00135 and abs(r.lon - p_lon) < 0.00135 / cos(radians(p_lat))
  limit 1;
  if existing is not null then
    perform public.vote_report(existing, true);
    return existing;
  end if;
  insert into public.reports (kind, lat, lon, heading, reporter_id, expires_at)
  values (p_kind, p_lat, p_lon, p_heading, uid, now() + public.report_ttl(p_kind))
  returning id into new_id;
  return new_id;
end
$$;

-- "Still there" / "Not there". One vote per driver per report; not on your own.
-- A confirm extends the report; two "not there" votes take it off the radar.
create function public.vote_report(p_id bigint, p_still_there boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.reports;
begin
  if uid is null then raise exception 'Sign in to vote' using errcode = '28000'; end if;
  select * into r from public.reports where id = p_id;
  if r.id is null or r.expires_at <= now() then return; end if;
  if r.reporter_id = uid then return; end if;
  insert into public.report_votes (report_id, voter_id, still_there)
  values (p_id, uid, p_still_there)
  on conflict (report_id, voter_id) do update set still_there = excluded.still_there, created_at = now();
  update public.reports set
    confirms = (select count(*) from public.report_votes where report_id = p_id and still_there),
    clears = (select count(*) from public.report_votes where report_id = p_id and not still_there)
  where id = p_id;
  update public.reports set expires_at =
    case when clears >= 2 then now()
         when p_still_there then greatest(expires_at, now() + public.report_ttl(kind))
         else expires_at end
  where id = p_id;
end
$$;

-- Counts for your own profile screen.
create function public.my_social_counts()
returns table (followers bigint, following bigint, friends bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.follows where followee_id = auth.uid()),
    (select count(*) from public.follows where follower_id = auth.uid()),
    (select count(*) from public.follows a join public.follows b
       on a.followee_id = b.follower_id and b.followee_id = a.follower_id
     where a.follower_id = auth.uid())
$$;

-- "Delete my account": removes the auth user; everything above cascades.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  delete from auth.users where id = auth.uid();
end
$$;

revoke all on function public.report_ttl(public.report_kind) from public, anon, authenticated;
revoke all on function public.reports_near(double precision, double precision, double precision) from public;
revoke all on function public.submit_report(public.report_kind, double precision, double precision, smallint) from public, anon;
revoke all on function public.vote_report(bigint, boolean) from public, anon;
revoke all on function public.my_social_counts() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
-- The radar works before sign-in; reporting and voting need an account.
grant execute on function public.reports_near(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.submit_report(public.report_kind, double precision, double precision, smallint) to authenticated;
grant execute on function public.vote_report(bigint, boolean) to authenticated;
grant execute on function public.my_social_counts() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
