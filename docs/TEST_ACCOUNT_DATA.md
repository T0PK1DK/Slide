# Test account data (read-only for bots)

Slide opens as a built-in local test driver when `VITE_AUTH_ENABLED` is off
(the default). This page is how another bot compares that driver's commute
data without a password and without weakening production RLS.

Constants live in `src/lib/auth-config.ts`. Do not invent a second id.

| Field | Value |
|---|---|
| Profile id | `00000000-0000-4000-8000-000000000001` |
| Username | `slide_test` |
| Display name | `Test Driver` |
| Car tag | `SLIDE-01` |
| Synthetic email | `slide_test@users.slide.local` |

There is **no password** for this identity. It is not a row in `auth.users`
unless someone later creates a real account and we map it.

## How auth / RLS works while the flag is off

The robust approach: **do not mint a fake JWT and do not put a service-role
key in the client.**

- On-device keys (profile, garage / Home / Work, trip history, local ghosts,
  XP) are scoped to the test profile id via `setAccountOwner`. Those features
  keep working.
- Supabase RPCs that check `auth.uid()` (`submit_report`, `share_presence`,
  `share_ghost`, follows, …) stay off. The UI hides Sign out / Lock / sign-in
  instead of showing dead buttons.
- Existing username + password code is unchanged. Rebuild with
  `VITE_AUTH_ENABLED=true` to restore it (see below).

## Where the commute data actually is

Trip history is **on the phone first**. After the test driver is installed, the
keys are:

| Key | Shape |
|---|---|
| `slide.history.v1.00000000-0000-4000-8000-000000000001` | `TripRecord[]` (`src/lib/history.ts`) |
| `slide.profile.v1.00000000-0000-4000-8000-000000000001` | `{ name, tag, pinHash, createdAt, lastSeen, car }` |
| `slide.garage.v1.00000000-0000-4000-8000-000000000001` | Home / Work / recents / paint |
| `slide.ghosts.v1.00000000-0000-4000-8000-000000000001` | Last local GO ghost |
| `slide.xp.v1.00000000-0000-4000-8000-000000000001` | XP (if present) |
| `slide.session.v1.00000000-0000-4000-8000-000000000001` | `"on"` |

A bot that can see the same origin (Playwright / Puppeteer against a running
app, or a device export) reads commute data like this:

```js
JSON.parse(localStorage.getItem(
  "slide.history.v1.00000000-0000-4000-8000-000000000001"
) || "[]")
```

Each `TripRecord` has `startedAt`, `endedAt`, `destLabel`, `routeLabel`,
`distanceMi`, `plannedSec`, `actualSec`, `slideScore`, `lefts`,
`offRouteEvents`, `postedProfile`, and optional `tollRoad`.

## Supabase tables (same profile id)

These tables already exist in project `slide` (`supabase/migrations/`). They
are keyed by `auth.uid()` / `profiles.id`. With the flag off the app does not
write them as the test user (no JWT). A bot can still **read** leftover or
later-seeded rows for that id.

| Table | User column | What it is |
|---|---|---|
| `profiles` | `id` | Public handle / name / car tag |
| `follows` | `follower_id`, `followee_id` | Follow graph |
| `reports` | `reporter_id` | Driver reports (no public SELECT; use the service role) |
| `report_votes` | `voter_id` | Still there / not there |
| `presence` | `user_id` | Rough ~1 km friend share |
| `ghosts` | `user_id` | Latest live ghost point |
| `ghost_invites` | `from_id`, `to_id` | Ghost share invites |
| `drive_history` | `profile_id` | Best-effort copy of the test driver's trips (this PR). Anon cannot SELECT. |

Apply `supabase/migrations/20261031000000_drive_history.sql` in the SQL Editor
before Nard 2.0 can read commutes. This repo does **not** apply that migration.

### `public.drive_history` — remote commute copy (Nard 2.0)

localStorage stays the source of truth. The client calls
`upsert_test_drive_history(p_trips jsonb)` with at most 20 trips. The RPC
forces `profile_id` to the test id, validates shape/size, and upserts on
`id` (the local trip id, e.g. `t1729000000000`). Offline retries are
client-side. The UI is never blocked.

**Columns**

| Column | Type | Source |
|---|---|---|
| `id` | `text` PK | `TripRecord.id` |
| `profile_id` | `uuid` | always `00000000-0000-4000-8000-000000000001` |
| `started_at` | `timestamptz` | `startedAt` |
| `ended_at` | `timestamptz` | `endedAt` |
| `distance_mi` | `float8` | `distanceMi` |
| `duration_sec` | `int` | `actualSec` |
| `dest_label` | `text` | `destLabel` (≤120) |
| `route_label` | `text` | `Slide` / `Faster` / `Alt` |
| `summary` | `jsonb` | `{ destLabel, routeLabel, plannedSec, slideScore, lefts, offRouteEvents, postedProfile, tollRoad }` |
| `created_at` | `timestamptz` | first upsert |
| `updated_at` | `timestamptz` | last upsert |

**Security model**

- RLS on `drive_history`, **no table policies**. Anon/authenticated cannot
  SELECT or INSERT the table.
- Anon may `EXECUTE` `upsert_test_drive_history` only. The function is
  `SECURITY DEFINER`, rejects any `profile_id` other than the test id, and
  caps batch (20), payload (80 kB), and per-trip JSON (8 kB).
- Anon gets **no** SELECT on the table or on the view.
- Nard 2.0 reads through view `drive_history_test` (test profile rows only)
  as role `nard_readonly` (LOGIN + password set in the Dashboard, never the
  repo) using env **`NARD_READONLY_DATABASE_URL`**, **or** with
  **`SUPABASE_SERVICE_ROLE_KEY`** (Dashboard API key, never `VITE_`).

Clearing history on the phone does **not** delete server rows.

#### Example SQL (Nard / service role)

```sql
select id, profile_id, started_at, ended_at, distance_mi, duration_sec,
       dest_label, route_label, summary, created_at, updated_at
from public.drive_history_test
order by started_at desc
limit 50;
```

Same filter on the base table:

```sql
select id, started_at, ended_at, distance_mi, duration_sec, dest_label, route_label, summary
from public.drive_history
where profile_id = '00000000-0000-4000-8000-000000000001'
order by started_at desc;
```

#### Example REST

View (works with the service role; anon is denied):

```
GET {VITE_SUPABASE_URL}/rest/v1/drive_history_test?order=started_at.desc&limit=50
```

Headers: `apikey` + `Authorization: Bearer` = `SUPABASE_SERVICE_ROLE_KEY`
(name only). Do not use the anon key — there is no SELECT grant.

Postgres URL for the dedicated role: `NARD_READONLY_DATABASE_URL`
(Dashboard; `nard_readonly` has SELECT on the view only).

### Other tables (same profile id)

These already exist. They stay empty for the test id unless a real session
writes them.

### Example SQL (service role, read-only) — older tables

```sql
-- Replace nothing: this is the built-in test id.
select id, handle, display_name, car_tag, created_at
from public.profiles
where id = '00000000-0000-4000-8000-000000000001';

select id, kind, lat, lon, created_at, expires_at, confirms, clears
from public.reports
where reporter_id = '00000000-0000-4000-8000-000000000001'
order by created_at desc
limit 50;

select user_id, lat, lon, updated_at
from public.presence
where user_id = '00000000-0000-4000-8000-000000000001';

select user_id, display_name, lat, lon, heading_deg, speed_mps, updated_at
from public.ghosts
where user_id = '00000000-0000-4000-8000-000000000001';
```

### Example REST (PostgREST)

```
GET {VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.00000000-0000-4000-8000-000000000001
GET {VITE_SUPABASE_URL}/rest/v1/reports?reporter_id=eq.00000000-0000-4000-8000-000000000001&order=created_at.desc
GET {VITE_SUPABASE_URL}/rest/v1/presence?user_id=eq.00000000-0000-4000-8000-000000000001
GET {VITE_SUPABASE_URL}/rest/v1/ghosts?user_id=eq.00000000-0000-4000-8000-000000000001
```

Headers:

```
apikey: <key>
Authorization: Bearer <key>
```

`profiles` SELECT is `authenticated` only; `reports` / `presence` have no
direct SELECT policy (reads go through RPCs). A bot that needs those rows
must use the **service role** key, which bypasses RLS. The anon key is enough
only for RPCs granted to `anon` (today: `reports_near`, not "this user's
reports").

## Env vars and keys (names only)

| Name | Where | Use |
|---|---|---|
| `VITE_AUTH_ENABLED` | `.env.production` / build env | `true` or `1` restores sign-in. Default off. This sync does not change that flag. |
| `VITE_SUPABASE_URL` | `.env.production` | Project URL for REST / supabase-js. Public. |
| `VITE_SUPABASE_ANON_KEY` | `.env.production` | Publishable anon JWT. Used only to *call* `upsert_test_drive_history`. Cannot SELECT `drive_history`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API Keys (never the repo, never `VITE_`) | Server-only. Bypasses RLS. Nard 2.0 may use this to `SELECT` `drive_history_test`. |
| `NARD_READONLY_DATABASE_URL` | Dashboard secret (never the repo, never `VITE_`) | Optional Postgres URL for role `nard_readonly` (SELECT on `drive_history_test` only). |

Do not commit a password, a service-role key, or any other secret. Do not put
`SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable.

## How to turn sign-in back on

1. Set `VITE_AUTH_ENABLED=true` in `.env.production` (or the shell).
2. Rebuild (`npm run build`) so Vite bakes the flag in.
3. Redeploy Pages when King asks. This PR does not deploy.

The username + password gate in `src/hud/login.ts` and `src/lib/account.ts`
is unchanged behind that flag.
