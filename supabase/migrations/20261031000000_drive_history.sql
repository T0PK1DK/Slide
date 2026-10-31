-- Test-driver commute mirror for Nard 2.0 (read-only).
--
-- localStorage (slide.history.v1.<test id>) stays the source of truth. The
-- Slide client upserts a copy of those trips through upsert_test_drive_history.
-- Apply this file in the Supabase SQL Editor — this migration is not applied
-- by the app or this PR.
--
-- Security:
--   * RLS on, no table policies → anon/authenticated cannot SELECT/INSERT.
--   * Anon may only call the SECURITY DEFINER RPC, which forces profile_id
--     to the built-in test driver and caps payload size.
--   * Nard reads via view drive_history_test + role nard_readonly, or a
--     Dashboard service-role / read-only URL (env names only; no secrets here).

-- Well-known local test driver (src/lib/auth-config.ts). Not an auth.users row.
-- Keep in sync with TEST_USER_ID.
-- 00000000-0000-4000-8000-000000000001

create table public.drive_history (
  id text primary key check (char_length(id) between 1 and 80),
  profile_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_mi double precision not null check (distance_mi >= 0 and distance_mi <= 2000),
  duration_sec integer not null check (duration_sec >= 0 and duration_sec <= 604800),
  dest_label text not null default '' check (char_length(dest_label) <= 120),
  route_label text not null default '' check (char_length(route_label) <= 16),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at >= started_at),
  check (octet_length(summary::text) <= 4000)
);
create index drive_history_profile_started_idx
  on public.drive_history (profile_id, started_at desc);
comment on table public.drive_history is
  'Best-effort copy of on-device trip history for the built-in test driver. localStorage is the source of truth.';
alter table public.drive_history enable row level security;
-- No policies on purpose: every write goes through upsert_test_drive_history;
-- reads go through drive_history_test (Nard) or the service role.

revoke all on table public.drive_history from public, anon, authenticated;

create or replace view public.drive_history_test
with (security_barrier = true) as
select
  id, profile_id, started_at, ended_at, distance_mi, duration_sec,
  dest_label, route_label, summary, created_at, updated_at
from public.drive_history
where profile_id = '00000000-0000-4000-8000-000000000001'::uuid;

comment on view public.drive_history_test is
  'Read-only commute rows for the built-in test driver. For Nard 2.0.';

revoke all on public.drive_history_test from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nard_readonly') then
    create role nard_readonly nosuperuser nocreatedb nocreaterole nologin;
  end if;
exception when insufficient_privilege then
  raise notice 'create role nard_readonly skipped — add it in the Dashboard, then grant SELECT on drive_history_test';
end $$;

do $$
begin
  grant usage on schema public to nard_readonly;
  grant select on public.drive_history_test to nard_readonly;
exception when undefined_object then
  raise notice 'role nard_readonly missing — grant SELECT on drive_history_test after creating it';
when insufficient_privilege then
  raise notice 'grant to nard_readonly skipped';
end $$;

do $$
begin
  comment on role nard_readonly is
    'Read-only for Nard 2.0. Enable LOGIN + a password in the Dashboard (never the repo). Connection env name: NARD_READONLY_DATABASE_URL.';
exception when undefined_object then
  null;
end $$;

create or replace function public.upsert_test_drive_history(p_trips jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  test_id uuid := '00000000-0000-4000-8000-000000000001';
  item jsonb;
  n int := 0;
  tid text;
  started timestamptz;
  ended timestamptz;
  dist double precision;
  dur int;
  dest text;
  route text;
  summary jsonb;
begin
  if p_trips is null or jsonb_typeof(p_trips) <> 'array' then
    raise exception 'trips must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_trips) < 1 then
    return 0;
  end if;
  if jsonb_array_length(p_trips) > 20 then
    raise exception 'at most 20 trips per call' using errcode = '54000';
  end if;
  if octet_length(p_trips::text) > 80000 then
    raise exception 'payload too large' using errcode = '54000';
  end if;

  for item in select value from jsonb_array_elements(p_trips)
  loop
    if octet_length(item::text) > 8000 then
      raise exception 'trip too large' using errcode = '54000';
    end if;
    if (item->>'profile_id') is distinct from test_id::text then
      raise exception 'only the test driver can sync' using errcode = '42501';
    end if;
    tid := item->>'id';
    if tid is null or char_length(tid) < 1 or char_length(tid) > 80
       or tid !~ '^[A-Za-z0-9._:-]+$' then
      raise exception 'bad trip id' using errcode = '22023';
    end if;
    started := (item->>'started_at')::timestamptz;
    ended := (item->>'ended_at')::timestamptz;
    if started is null or ended is null or ended < started then
      raise exception 'bad trip times' using errcode = '22023';
    end if;
    dist := (item->>'distance_mi')::double precision;
    dur := (item->>'duration_sec')::integer;
    if dist is null or dist < 0 or dist > 2000 or dur is null or dur < 0 or dur > 604800 then
      raise exception 'bad trip distance or duration' using errcode = '22023';
    end if;
    dest := left(coalesce(item->>'dest_label', ''), 120);
    route := left(coalesce(item->>'route_label', ''), 16);
    if route not in ('Slide', 'Faster', 'Alt') then
      raise exception 'bad route label' using errcode = '22023';
    end if;
    summary := coalesce(item->'summary', '{}'::jsonb);
    if octet_length(summary::text) > 4000 then
      raise exception 'summary too large' using errcode = '54000';
    end if;

    insert into public.drive_history (
      id, profile_id, started_at, ended_at, distance_mi, duration_sec,
      dest_label, route_label, summary, created_at, updated_at
    ) values (
      tid, test_id, started, ended, dist, dur, dest, route, summary, now(), now()
    )
    on conflict (id) do update set
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      distance_mi = excluded.distance_mi,
      duration_sec = excluded.duration_sec,
      dest_label = excluded.dest_label,
      route_label = excluded.route_label,
      summary = excluded.summary,
      updated_at = now()
      -- profile_id never changes; conflict is by trip id
    where public.drive_history.profile_id = test_id;

    n := n + 1;
  end loop;
  return n;
end
$$;

comment on function public.upsert_test_drive_history(jsonb) is
  'Anon write path for the built-in test driver only. Validates profile_id + size. No SELECT.';

revoke all on function public.upsert_test_drive_history(jsonb) from public;
grant execute on function public.upsert_test_drive_history(jsonb) to anon, authenticated;
