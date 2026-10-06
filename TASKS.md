# Slide tasks

Work top-down. Check the box in the same PR.

## Strategy

> Handed to Nard again on 2026-09-25 after PR #13. Start at **Next for Nard** in `HANDOFF.md` (turn on data → verify → stability → features).

- [x] Phase 0–1: `docs/STRATEGY.md` (Magi pass + design recon)
- [x] **Grim PR 1:** design system rebuild — one token file (`src/styles/tokens.css`), Night/Ember/Sand via `[data-look]`, stacked CSS layers deleted, teammate slots documented
- [x] **Grim PR 2:** screen pass — review carousel, drive Report/speedo, report grid + subtypes, place card, fail sheets, arrival trip card, empty states
- [x] **Grim PR 3:** polish — desktop drive top row + End vs map stack, `.is-empty` placeholders, Sand map/surfaces, unsigned `--` speed-limit sign
- [ ] Phase 4/5: 3D living map — garage car on Explore, "Miami driven %" (on-device), Effort icons on the route
- [ ] Presence design (friends' cars, opt-in) before any backend
- [ ] Phase 3: `rankRoutes()` = least Effort within +10% of fastest (today it has no time bound)

## Phase 1 — Better routes (owner prompt, 2026-09-25)

- [x] **Traffic-aware ETAs** — TomTom Routing `traffic=true` via `/api/traffic/route` (Leon can call `fetchTrafficRoute`); flow-segment along-route is the fallback. Typical time kept when the key is missing. HERE still the pick if we want toll prices.
- [x] **TomTom search first** — Fuzzy + typeahead suggest in `/api/geocode` + `/api/suggest`, daily ~1,500 search / 2,500 total budget, Photon/Nominatim/Census fallback
- [x] **TomTom speed limits** — Routing `speedLimit` sections overlay `#limit` when the free tier sends them
- [x] **TomTom incident details** — merged into `/api/incidents`, deduped with FDOT/Miami-Dade, type + delay + description
- [x] 3+ routes drawn together (Slide / Fastest / No-tolls costings + `alternates`), tap line or bubble to select
- [x] Tags: Slide pick, Fastest, No tolls (Your usual comes with Phase 2 learning)
- [x] Tolls flagged per route from Valhalla `has_toll`; "Has tolls" with no price until a price source exists
- [x] Route options sheet: avoid tolls / highways / ferries (saved)
- [x] Add stops (up to 5), drag to reorder, dropped as reached
- [ ] Verify on the live site: real Valhalla returns `alternates` and `has_toll` for Fort Lauderdale → 9601 Collins Ave

- [x] Desktop Command view: SEKAI Live Network pass (tiles + trends, week sparkline, alert list, navigation intelligence + Switch) — phones unchanged
- [x] Live incidents in the alert list — FDOT / Miami-Dade / driver reports on the map + Command; TomTom when keyed

- [x] Remove bot data: seeded ghost drivers and the old demo preview page
- [x] Profile: driver, My car, all-time stats, places, privacy (on-device)
- [x] Accounts (Supabase, username + password since 2026-10-06; was email code), profiles, follow/unfollow, friends = mutual follows, driver search
- [x] **Sign-in: username + password, no email** (King, 2026-10-06) — `<username>@users.slide.local` under Supabase Auth, Sign in / Create account sheet, magic link + OTP removed, tests (branch `nard/username-password-auth`)
- [ ] **King/Nard:** Supabase → Authentication → Sign In / Providers → Email → **Confirm email OFF** (needed before anyone can create a username account)
- [ ] Later: password reset without email (e.g. admin reset or recovery code); older email-only accounts need a new username account
- [x] Radar mini map + driver reports (police, crash, hazard, closure, jam) with votes, heads-up banner, FL511 incidents
- [x] Supabase project `slide` created + schema applied (2026-10-04); the last 2 functions pasted in the SQL Editor (2026-10-04)
- [x] `VITE_SUPABASE_URL` + anon key (`.env.production`), production redeployed, `TRANSIT_FEEDS` secret (Broward, Tri-Rail, Brightline) — 2026-10-04
- [x] Production redeployed from `main` @ d6b83e8 (PRs #16–#18): accounts on, email-link sign-in, Try again sheet, faster load (2026-10-04)
- [ ] **Nard:** FL511 key (optional now), redeploy (HANDOFF → Owner setup); Miami-Dade transit needs a Swiftly key from King
- [x] Sign in by tapping the emailed link (desktop / Safari) or typing the 6-digit `{{ .Token }}` OTP in the app (Home Screen). Nard pastes the Magic Link template.
- [x] Persistent Slide accounts: email OTP in this app (`verifyOtp` type `email`) + magic link option; `persistSession` / `autoRefreshToken` keep that app signed in after the first code. No D1. No new SQL — Nard pastes the template, confirms Site URL + Redirect URLs, then redeploys.
- [x] Official incidents without a key: FDOT DIVAS + Miami-Dade Police merged in `/api/incidents`, per-source status (FL511 optional)
- [ ] Verify FL511 field names against the first real payload (only if a key is added)
- [ ] Later: FDOT WZDx work zones
- [x] Live buses/trains on the radar (GTFS-realtime via TRANSIT_FEEDS) — Broward, Tri-Rail, Brightline live; Miami-Dade waits on a Swiftly key
- [x] Speed / red-light cameras on the radar (OpenStreetMap via Overpass)
- [x] Friends on the map: opt-in, server-rounded ~1 km, mutual friends only, 15 min expiry, one-tap stop, hidden while driving
- [ ] Real pace ghost: record your own GPS run per route and replay it (replaces the removed fake ghosts)

## Phase 2–5 (not started): save + learn, transit/walk/bike, home sheet, worker features — see the owner prompt in the 2026-09-25 session log

## P0 — make the demo reliable

- [x] **App doesn't start**: `sameTrip` / `tripShape` missing from `valhalla.ts` (browser module error → blank screen)
- [x] Route line draws again (MapLibre rejected zoom-inside-case expressions on all four route layers)
- [x] "You are here" marker on the map whenever location is on
- [x] Navigation on real GPS: start from GPS, Go starts tracking, camera follows, reroute when off-route, arrival (HANDOFF → Next for Nard)
- [x] Command view (SEKAI dashboard, real data only) + phone Drive insights sheet + on-device trip history
- [x] Satellite imagery: owner says optional — Satellite tab stays disabled, no paid source
- [x] On-device login: set up driver, stay signed in, lock, optional PIN, Add to Home Screen manifest
- [x] Installable PWA: PNG + maskable + apple-touch icons, shell-only service worker (Chrome reports no installability errors)
- [x] Posted speed double-converted (30 mph showed as 19) — fixed in `buildBands()`
- [ ] **Human device test:** real iPhone (Safari) + Android (Chrome) drive, and Add to Home Screen → opens full screen, stays signed in
- [x] HUD/login before MapLibre (Slow 4G 2.66 → 0.79 s) + style pre-cached in sw.js; map rendered 5.97 → 5.03 s cold, ≈2.6 s repeat, 2.86 s good 4G
- [ ] Map under 3 s on a *cold* Slow-4G visit: needs fewer bytes (self-hosted/slimmer tiles, 1× sprite)
- [ ] Faster alternative rarely exists on public Valhalla (same trip from both costings) — needs self-host or a real alternate strategy
- [x] Offline / no-route sheet + one fetch retry
- [x] Destination search geocodes typed street addresses (TomTom Fuzzy → Photon → Nominatim → Census); Enter / Drop the line no longer require a tapped suggestion

- [x] `npm run build` is clean (fix TS, unused, layer add-before-style-load)
- [x] If Valhalla returns one trip, fire a second `/route` with higher `use_highways` / lower `maneuver_penalty` so Faster exists (preview)
- [ ] Fit camera to route on first plan (cinematic), then allow Chase
- [x] Real GPS speed in the speedo when Locate is active (`watchPosition`)
- [ ] Upcoming posted-speed chip: “Hold 45 → 30 in 0.4 mi”
- [x] GitHub Pages (or Cloudflare Pages) so the owner can open it on a phone

## P1 — navigation that feels finished

- [x] Turn-by-turn next instruction banner from Valhalla maneuvers (preview GO mode)
- [x] Lane guidance: real Valhalla `lanes` in Grim's `#lane-strip` (PR #35 slot). Hidden with no data.
- [x] Spoken turn-by-turn (`speechSynthesis`); mute is Grim's `#drive-mute` (`slide:voice-mute`)
- [ ] Snap player marker to shape from live GPS (map matching later)
- [ ] Leave-by: user sets arrival clock → show depart time + 3 min buffer (`leaveByForTarget` already exists)
- [ ] Door-level destination note in UI (entrance / garage) even if pin is still centroid
- [x] Offline message when Photon/Valhalla fail

## P2 — ghosts that can become real

- [x] Record local ghost of last GO in localStorage and replay as YOU
- [ ] Replay *your* last ghost against the new run
- [ ] Sketch `src/lib/presence.ts` with `GhostSample` wire format (`tag`, `color`, `lon`, `lat`, `bearing`, `t`, `routeHash`)
- [ ] Do not build a full multiplayer backend until P0 is done

## Game layer (Leon — DESIGN-RESEARCH §4 step 4)

- [x] Smooth-score engine from real GPS telemetry; faster never pays more; missing signals skipped (`src/lib/game/smoothScore.ts`)
- [x] XP + levels from smooth score and smooth miles only (`src/lib/game/xp.ts`, curve in `docs/GAME-LAYER.md`)
- [x] Tiered badges, no licensed brands (`src/lib/game/badges.ts`)
- [x] Unlocks mapped to original rides/liveries; starter six still free (`src/lib/game/unlocks.ts`)
- [x] On-device progress (`slide.game.v1`) + `useGameProgress()` for Grim's slots (`docs/GAME-LAYER.md`)
- [x] Share card renderer + `mountShareCard` / `shareTrip` (1080×1350 PNG, no addresses) — Grim still places the slot
- [x] Opt-in weekly leaderboard local model + `rankWeek` + sync contract in `docs/GAME-LAYER.md` (default OFF, no fake friends)
- [x] Opal-style unlock stage + lazy 3D car (`#car-stage`, original low-poly, unlock labels)
- [x] Arrival XP + share-card slots wired (`#arr-xp`, `#share-card-mount` + `#g-board` opt-in)
- [ ] Friends leaderboard UI + backend sync (later; opt-in, mutual friends, contract in GAME-LAYER.md)

## P3 — cars and camera

- [x] Pick-your-ride: 6 original top-down cars, paint + livery + glow, Garage showroom (`src/lib/vehicles.ts`). Later: 3D models (MapLibre custom layer / Three), licensed collab packs
- [x] Unlockable originals (Nimbus, Glider) + Halo/Dusk liveries — gated by the game layer, not shown in the Garage picker yet
- [ ] Trail particles or denser dashed ghost trails
- [ ] Building extrusion fallback if `source-layer: building` missing (hide toggle, don’t crash)

## P4 — Miami-quality data

- [ ] Document how to self-host Valhalla for Florida extract
- [x] Hook for FDOT / 511 speeds into `expectedMph` (`min(posted, live)`) — live delay from TomTom Flow Segment Data on the selected line (posted still the sign; never a target)
- [ ] School-zone time window penalty in `smooth.ts`

## Out of scope until asked

Native iOS/Android, CarPlay, ads, server accounts (on-device login exists), Google/Mapbox paid tiles, police alerts.
