-- Precise live ghosts (Forza-style cars). Separate from rough ~1 km presence.
-- Privacy (src/lib/live-ghosts/rules.ts):
--   * Off until the driver publishes. pause_ghost / stop_ghost delete the row.
--   * Share only after invite + accept. Accepted is mutual.
--   * Latest point only. friends_ghosts() drops rows older than 45 seconds.
--   * Realtime SELECT uses the same accepted-invite rule (RLS).

create table public.ghost_invites (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (from_id, to_id),
  check (from_id <> to_id)
);
create index ghost_invites_to_idx on public.ghost_invites (to_id, status);
alter table public.ghost_invites enable row level security;

create table public.ghosts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  car_model_key text not null check (char_length(car_model_key) between 1 and 32),
  color text not null check (color ~ '^#[0-9A-Fa-f]{3,8}$'),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  heading_deg double precision not null,
  speed_mps double precision not null check (speed_mps >= 0),
  updated_at timestamptz not null default now()
);
alter table public.ghosts enable row level security;
alter table public.ghosts replica identity full;

create policy "See ghost invites you are part of" on public.ghost_invites
  for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));

create policy "Approved friends can read live ghosts" on public.ghosts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.ghost_invites i
      where i.status = 'accepted'
        and (
          (i.from_id = (select auth.uid()) and i.to_id = ghosts.user_id)
          or (i.to_id = (select auth.uid()) and i.from_id = ghosts.user_id)
        )
    )
  );

create function public.invite_ghost(p_handle text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  other uuid;
  new_id bigint;
  existing public.ghost_invites;
begin
  if uid is null then raise exception 'Sign in to invite' using errcode = '28000'; end if;
  select p.id into other from public.profiles p
    where p.handle = lower(btrim(trim(leading '@' from coalesce(p_handle, ''))));
  if other is null then raise exception 'No driver with that handle' using errcode = 'P0002'; end if;
  if other = uid then raise exception 'You cannot invite yourself' using errcode = '22023'; end if;
  if exists (
    select 1 from public.ghost_invites i
    where i.status = 'accepted'
      and ((i.from_id = uid and i.to_id = other) or (i.from_id = other and i.to_id = uid))
  ) then
    raise exception 'Already sharing with this driver' using errcode = '23505';
  end if;
  select * into existing from public.ghost_invites i where i.from_id = uid and i.to_id = other;
  if existing.id is not null then
    if existing.status = 'pending' then return existing.id; end if;
    update public.ghost_invites
      set status = 'pending', created_at = now(), resolved_at = null
      where id = existing.id;
    return existing.id;
  end if;
  insert into public.ghost_invites (from_id, to_id, status)
  values (uid, other, 'pending')
  returning id into new_id;
  return new_id;
end
$$;

create function public.respond_ghost_invite(p_id bigint, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  inv public.ghost_invites;
begin
  if uid is null then raise exception 'Sign in to answer an invite' using errcode = '28000'; end if;
  select * into inv from public.ghost_invites where id = p_id;
  if inv.id is null or inv.to_id <> uid or inv.status <> 'pending' then return; end if;
  update public.ghost_invites
    set status = case when p_accept then 'accepted' else 'declined' end,
        resolved_at = now()
    where id = p_id;
end
$$;

create function public.revoke_ghost_share(p_other uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  update public.ghost_invites
    set status = 'revoked', resolved_at = now()
    where status in ('pending', 'accepted')
      and ((from_id = uid and to_id = p_other) or (from_id = p_other and to_id = uid));
end
$$;

create function public.share_ghost(
  p_lat double precision,
  p_lon double precision,
  p_heading_deg double precision,
  p_speed_mps double precision,
  p_car_model_key text,
  p_color text,
  p_display_name text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  dname text;
begin
  if uid is null then raise exception 'Sign in to share' using errcode = '28000'; end if;
  select p.display_name into dname from public.profiles p where p.id = uid;
  if dname is null then raise exception 'Create your driver profile first' using errcode = '28000'; end if;
  if exists (
    select 1 from public.ghosts g
    where g.user_id = uid and g.updated_at > now() - interval '2 seconds'
  ) then
    return;
  end if;
  insert into public.ghosts (
    user_id, display_name, car_model_key, color, lat, lon, heading_deg, speed_mps, updated_at
  ) values (
    uid,
    left(btrim(coalesce(nullif(p_display_name, ''), dname)), 24),
    coalesce(nullif(left(lower(regexp_replace(coalesce(p_car_model_key, 'classic'), '[^a-z0-9\-]', '', 'g')), 32), ''), 'classic'),
    case when coalesce(p_color, '') ~ '^#[0-9A-Fa-f]{3,8}$' then p_color else '#e8eef2' end,
    p_lat,
    p_lon,
    mod((p_heading_deg + 360)::numeric, 360)::double precision,
    greatest(p_speed_mps, 0),
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    car_model_key = excluded.car_model_key,
    color = excluded.color,
    lat = excluded.lat,
    lon = excluded.lon,
    heading_deg = excluded.heading_deg,
    speed_mps = excluded.speed_mps,
    updated_at = now();
end
$$;

create function public.pause_ghost()
returns void
language sql security definer set search_path = '' as $$
  delete from public.ghosts where user_id = auth.uid();
$$;

create function public.stop_ghost()
returns void
language sql security definer set search_path = '' as $$
  delete from public.ghosts where user_id = auth.uid();
$$;

create function public.friends_ghosts()
returns table (
  user_id uuid, display_name text, car_model_key text, color text,
  lat double precision, lon double precision, heading_deg double precision,
  speed_mps double precision, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select g.user_id, g.display_name, g.car_model_key, g.color,
         g.lat, g.lon, g.heading_deg, g.speed_mps, g.updated_at
  from public.ghosts g
  where g.updated_at > now() - interval '45 seconds'
    and g.user_id <> auth.uid()
    and exists (
      select 1 from public.ghost_invites i
      where i.status = 'accepted'
        and (
          (i.from_id = auth.uid() and i.to_id = g.user_id)
          or (i.to_id = auth.uid() and i.from_id = g.user_id)
        )
    )
  order by g.updated_at desc
  limit 50
$$;

create function public.list_ghost_invites()
returns table (
  id bigint, from_id uuid, to_id uuid, handle text, display_name text,
  status text, incoming boolean, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.from_id, i.to_id,
         p.handle, p.display_name, i.status,
         (i.to_id = auth.uid()) as incoming, i.created_at
  from public.ghost_invites i
  join public.profiles p on p.id = case when i.from_id = auth.uid() then i.to_id else i.from_id end
  where i.from_id = auth.uid() or i.to_id = auth.uid()
  order by i.created_at desc
  limit 100
$$;

revoke all on function public.invite_ghost(text) from public, anon;
revoke all on function public.respond_ghost_invite(bigint, boolean) from public, anon;
revoke all on function public.revoke_ghost_share(uuid) from public, anon;
revoke all on function public.share_ghost(double precision, double precision, double precision, double precision, text, text, text) from public, anon;
revoke all on function public.pause_ghost() from public, anon;
revoke all on function public.stop_ghost() from public, anon;
revoke all on function public.friends_ghosts() from public, anon;
revoke all on function public.list_ghost_invites() from public, anon;

grant execute on function public.invite_ghost(text) to authenticated;
grant execute on function public.respond_ghost_invite(bigint, boolean) to authenticated;
grant execute on function public.revoke_ghost_share(uuid) to authenticated;
grant execute on function public.share_ghost(double precision, double precision, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.pause_ghost() to authenticated;
grant execute on function public.stop_ghost() to authenticated;
grant execute on function public.friends_ghosts() to authenticated;
grant execute on function public.list_ghost_invites() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.ghosts;
exception when others then
  null;
end $$;
