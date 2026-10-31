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

Trip history is **on the phone**, not in a Supabase `trips` table. That is the
HANDOFF rule (drives stay on-device). After the test driver is installed, the
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

There is no `trips` / `commutes` table. Compare drives from the local history
key above.

### Example SQL (service role, read-only)

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
| `VITE_AUTH_ENABLED` | `.env.production` / build env | `true` or `1` restores sign-in. Default off. |
| `VITE_SUPABASE_URL` | `.env.production` | Project URL for REST / supabase-js. Public. |
| `VITE_SUPABASE_ANON_KEY` | `.env.production` | Publishable anon JWT. Public by design; RLS applies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API Keys (never the repo, never `VITE_`) | Server-only. Bypasses RLS. Use for the read-only queries above. |

Do not commit a password, a service-role key, or any other secret. Do not put
`SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable.

## How to turn sign-in back on

1. Set `VITE_AUTH_ENABLED=true` in `.env.production` (or the shell).
2. Rebuild (`npm run build`) so Vite bakes the flag in.
3. Redeploy Pages when King asks. This PR does not deploy.

The username + password gate in `src/hud/login.ts` and `src/lib/account.ts`
is unchanged behind that flag.
