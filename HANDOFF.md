# Slide — agent handoff

**Repo:** https://github.com/T0PK1DK/Slide  
**Owner:** T0PK1DK  
**Product:** driver-first nav. Smoothest route wins. Posted speeds + precise timing. 3D HUD. Forza-style ghosts. Garage customization.

This file is the source of truth for Cursor, Claude Code, and Grok when hopping back in. Do not rewrite the product. Finish it.

## Run

```bash
npm install
npm run dev
```

Vite + TypeScript. No env file required: without env vars, accounts, radar feeds and transit simply stay off. See **Owner setup for accounts + radar** to turn them on.

- Routing: `https://valhalla1.openstreetmap.de`
- Geocode: `/api/geocode` + `/api/suggest` → TomTom Fuzzy first (when `TOMTOM_API_KEY` is set and the daily search budget has room), then Photon → Nominatim (Worker, 1 req/s) → US Census. Direct Photon if the Function is missing.
- Tiles: `https://tiles.openfreemap.org/styles/dark`

Units are **miles / mph**. First proving ground is **Miami**.

## What already works

Everything below is on `main` (PR #13, 2026-09-25): 0 TS errors, 54/54 unit tests, `npm run build` clean.

- **Search + plan:** typed addresses geocode on Enter / Drop the line (TomTom Fuzzy → Photon → Nominatim → US Census). Autocomplete while typing (350 ms debounce, 3 chars, stale requests cancelled). GPS locate, a "you" marker, and up to 5 stops (drag to reorder).
- **Routes:** Valhalla `/route` + `/trace_attributes`. Three or more lines are drawn together; tap a line or its bubble to pick one.
  - Tags: **Slide pick** (smoothest within +10% of fastest), **Fastest**, **No tolls**.
  - Routes with tolls are flagged; there's no price yet.
  - The Options sheet can avoid tolls, highways and ferries.
- **Drive:** live GPS only (nothing simulated), a next-turn banner, the camera follows the driver, reroute when off-route, and an Arrival screen.
- **On-device account:** login gate, PIN lock, Profile (driver, My car, all-time stats, places, privacy), trip history, and the Command view on desktop (≥1100 px).
- **Radar** (on once the owner adds the keys):
  - Driver reports: police, crash, hazard, closure, jam, with votes.
  - FL511 official incidents.
  - Speed and red-light cameras from OpenStreetMap (no key needed).
  - Live buses and trains from GTFS-realtime.
  - A heads-up banner with vibration.
- **Accounts** (Supabase): **username + password, no email** (username maps to a hidden `<username>@users.slide.local`; needs Supabase "Confirm email" OFF); anyone can join; session restored on load in that same app; @handle, followers / following / friends, driver search, and opt-in rough location for friends on the map. Sign out from the gate and Profile.
- **Installable PWA** on Cloudflare Pages: https://kings-slide.pages.dev
- **Off until configured:** without the env vars, accounts, reports, FL511 and transit stay hidden and the rest of the app works.

## Layout

```
src/boot.ts            entry: paints HUD + login gate, warms the map style, then loads main.ts + MapLibre
src/hud/shell.ts       HUD markup (painted by boot.ts before MapLibre arrives)
src/map/warm.ts        style fetch + sprite/glyph preload once MapLibre has downloaded (pure warmUrls tested)
src/plan/failure.ts    offline / no-route / busy / unreachable wording for the Try again sheet (pure)
src/plan/failure.test.ts  tests for failure wording + warmUrls
src/main.ts            map + plan + drive loop (HUD listeners)
src/styles.css         HUD stylesheet (tokens → base → components → screens)
src/styles/tokens.css  Night / Ember / Sand tokens (only file with raw hex)
src/styles/system.test.ts  design-system metrics (hex, radii, type, !important)
src/lib/empty.ts       empty-state copy (never "—"); `.is-empty` helper; unsigned sign `--`
src/lib/empty.test.ts  placeholder vs numeral + postedSignText
src/lib/place.ts       Photon label → name + address
src/lib/geocode.ts     address parse + TomTom-first / Photon / Nominatim / Census chain (tested)
src/lib/geocode.test.ts  King's street / shops / ZIP / intersection queries + TomTom first
src/lib/tomtom-search.ts  Fuzzy Search → SearchHit (pure)
src/lib/tomtom-route.ts  Routing traffic ETA + speedLimit sections; `fetchTrafficRoute()` for Leon
src/lib/tomtom-budget.ts  daily 1,500 search / 2,500 total counters + cache TTLs
src/lib/incidents-merge.ts  TomTom ↔ FDOT/MDPD dedupe
functions/api/geocode.ts  Pages Function: TomTom first + budget, then Nominatim throttle; Vite plugin mirrors it
functions/api/suggest.ts  Autocomplete alias of /api/geocode?mode=suggest
src/plan/review-cards.ts  swipeable review cards from real ranked routes
src/hud/voice-mute.ts  `#drive-mute` toggle + `slide:voice-mute` event
src/voice/             spoken turn-by-turn; listens for `slide:voice-mute`, mirrors `slide.voice.v1`
src/hud/report-ui.ts   report glass icons + subtypes (submit still sends kind)
src/node-fs.d.ts       types for the metrics test
tools/shoot-screens.mjs  phone/desktop HUD screenshots (390 + 1440)
src/lib/valhalla.ts    route / trace
src/lib/smooth.ts      Slide score + speed bands
src/lib/polyline.ts    precision-6 decode
src/lib/garage.ts      customization persist
src/lib/ghosts.ts      ghost replay along a line
src/lib/guidance.ts    next maneuver, posted-speed lookahead, turn arrows
src/lanes/             Valhalla turn-lane strip for Grim's `#lane-strip` slot
src/lib/tracking.ts    live GPS watch + snap-to-route progress
src/lib/maplook.ts     night basemap lift (per theme), route ribbon, HUD fit padding
src/lib/vehicles.ts    rides: original top-down car designs (SVG), starter + unlockable liveries, pack field for future collabs (tested)
src/lib/game/          smooth score, XP/levels, badges, unlocks, share card, weekly board, `useGameProgress`, lazy 3D stage
src/lib/game/carStage.ts  original low-poly three.js stage (lazy chunk; SVG fallback)
src/lib/game/carMeshes.ts  procedural ride hulls + livery materials (no model files)
src/lib/game/*.test.ts game-layer unit tests (speed never raises XP; share-card privacy; week rank)
src/hud/gameSlots.ts   fills `#arr-xp`, `#share-card-mount`, `#car-stage` (unhide with `.hidden = false`)
docs/GAME-LAYER.md     exported game API + share card + future leaderboard sync contract
tools/shoot-game-wire.mjs  mobile shots of arrival XP, share card, car stage
src/lib/profile.ts     on-device driver profile, session, PIN hash, persistent storage (keyed to the signed-in account)
src/lib/auth-storage.ts  supabase-js storage: localStorage + 90-day SameSite=Lax cookie (Safari ↔ Home Screen)
src/lib/account-store.ts  per-account local keys for home/work, history, ghosts, XP
src/lib/account.ts     username ↔ synthetic email, sign up / sign in with password, session restore, onAuthStateChange, sign-out
src/hud/login.ts       login gate: Sign in / Create account (username + password), then driver setup / welcome back (PIN) / sign-out
src/map/you.ts         "you are here" marker: glow dot, pulse, heading cone, accuracy halo
src/hud/command.ts     Command view: SEKAI-style dashboard (wide) / Insights sheet (phone)
src/lib/history.ts     on-device trip history + overview stats (live-GPS drives only)
src/plan/routeset.ts   merge route variants, bubble placement, toll labels (pure, tested)
src/plan/stops.ts      multi-stop helpers: reorder, stop reached, drop index (pure, tested)
src/plan/routes.test.ts  Vitest unit tests (`npm test`)
src/lib/alerts.ts      desktop alert list + switch suggestion from real data only (pure, tested)
src/lib/dashboard.test.ts  tests for alerts / week tiles
src/hud/profile.ts     Profile sheet: driver, My car, all-time stats, places, privacy; friends section (not live)
src/lib/cloud.ts       optional Supabase client (persistSession, autoRefreshToken; detectSessionInUrl off, no emailed links)
src/lib/cloud.test.ts  tests for the auth client flags
src/lib/social.ts      profiles, follow/unfollow, friends, search (sign-in lives in account.ts)
src/lib/reports.ts     radar items, heading-up geometry, alerts, report/vote RPCs
src/lib/sources/fl511.ts  FL511 event → radar item (pure, tested)
src/lib/sources/fdot.ts   FDOT DIVAS event → radar item, South Florida query URL (pure, tested)
src/lib/sources/mdpd.ts   Miami-Dade Police traffic call → radar item, Miami local time → UTC (pure, tested)
src/lib/incidents.test.ts tests for the FDOT + MDPD mappers (live-shaped fixtures)
src/hud/radar.ts       mini radar, Report sheet, heads-up banner, Nearby list
src/hud/social.ts      Profile → Friends & followers (sign in, handle, lists, search)
functions/api/incidents.ts  Pages Function: FDOT DIVAS + Miami-Dade Police (keyless) + FL511 + TomTom Incident Details (if keyed) merged + deduped, per-source status
functions/api/traffic/[[path]].ts  Pages Function: TomTom proxy (status, flow tiles, incidents, along-route, **route** traffic ETA + speed limits). Secret TOMTOM_API_KEY
functions/api/cameras.ts    Pages Function: OSM enforcement cameras via Overpass (24 h tile cache)
functions/api/transit.ts    Pages Function: GTFS-realtime buses/trains from TRANSIT_FEEDS secret
functions/api/geocode.ts    Pages Function: TomTom Fuzzy first, then Photon → Nominatim → US Census
functions/api/suggest.ts    Pages Function: search autocomplete (same chain)
src/lib/sources/tomtom.ts  TomTom incident + flow + Search/Routing URL builders (pure, tested)
src/lib/traffic.ts     status / Routing ETA / along-route / summary / route colour (pure + fetch)
src/lib/traffic.test.ts  traffic mappers, summary copy, garage toggle
src/map/traffic.ts     MapLibre flow layer, route congestion, incident pins + card
src/map/incident-icons.ts  original glass SVG pins + source labels
src/lib/sources/gtfsrt.ts   dependency-free GTFS-realtime VehiclePositions decoder (tested)
src/lib/sources/osmcameras.ts  Overpass query + camera mapping (tested)
src/lib/sources/transit.ts  feed config + vehicle → radar item (tested)
src/lib/presence.ts    friends on the map: share / stop / read (server rounds to ~1 km)
src/map/friends.ts     friend spots (rough area + chip), sharing pill; hidden while driving
supabase/migrations/   accounts, follows, reports schema + RLS (tested in PGlite)
src/lib/sources/weather.ts  Open-Meteo current conditions for the clock card (CC BY 4.0)
public/                web manifest, PNG/maskable/apple-touch icons, shell-only sw.js, Pages _headers (Add to Home Screen)
docs/PRODUCT.md        scoring contract
docs/DESIGN.md         VIA style contract + screen-by-screen build spec
docs/DESIGN-RESEARCH.md  design research (Waze/Google/Apple/game apps), root cause, full gap list, build order — read before any UI work
design/premium-glass-kit/  owner's design kit: tokens.css, DESIGN-SYSTEM.md, COMPONENTS.md (source for the token rebuild)
docs/STRATEGY.md       why Slide wins, Effort metric, design recon (Borrowed / Rejected / Unique)
HANDOFF.md             this file
.env.production        public build values (Supabase URL; anon key goes here) — kings-slide is Direct Upload
TASKS.md               ordered work
AGENTS.md / CLAUDE.md  short agent rules
```

## Product rules (do not violate)

1. Default route is **smoothest**, not fastest. Fast is an explicit choice.
2. Never suggest exceeding the posted limit. Expected speed = model; posted = sign.
3. No ads. **Owner decision 2026-09-25:** drivers may *report* police, crashes, hazards, closures and jams (Waze-style) on the radar. Slide never *tracks* police or emergency vehicles, since no legal real-time source exists, and it never invents a report. Reports are anonymous, expire, and can be cleared by other drivers.
4. Privacy: garage, drives, places and trip history stay on the device. The optional Supabase account holds only the handle, name, car tag, an opt-in car label, follows, and anonymous reports.
5. Ghosts are presence, not a race to cut neighborhoods.
6. Keep the night HUD. Do not flatten into a Google Maps clone.

## Known gaps (honest)

- Ghosts: the fake seeded drivers were **removed** (2026-09-25). No ghosts are drawn until a real source exists (your recorded pace run, or opt-in friends).
- Car marker is an SVG wedge, not a 3D model.
- Snap-to-route is nearest-segment projection, not real map matching.
- 3D buildings depend on OpenFreeMap `building` layer; fail soft if missing.
- `main.ts` is one file. Split when adding nav guidance / GPS follow.
- Public Valhalla/Photon can rate-limit. Plan for self-host.
- Phone demo is live on Cloudflare Pages: https://kings-slide.pages.dev (project `kings-slide`). Do not use slide.pages.dev — that hostname is an unrelated site.
- Turn-by-turn is the next-maneuver banner plus a lane strip in `#lane-strip` when Valhalla sends `lanes` within 0.75 mi, plus spoken guidance (`speechSynthesis`). Grim's `#drive-mute` owns the button; speech listens for `slide:voice-mute` / `html[data-voice]` and mirrors `slide.voice.v1`. No full step list.
- No leave-by target. Live traffic: FDOT / Miami-Dade / driver icons always (when the map has a centre). Green / yellow / red flow, TomTom Routing traffic ETA, speedLimit sections on the sign, and TomTom incident details need the Pages secret `TOMTOM_API_KEY`. Off in Garage → Live traffic.
- Native CarPlay requires an iOS app + Apple entitlement — Drive Mode is the phone-mounted stand-in.
- Leave-by and "Your usual" aren't built yet. Avoid options and multi-stop are done.

## Architecture next

Keep `/route` + `/trace_attributes` as the brain. Add layers around it.

## Conventions

- TypeScript strict. No `any` except Photon JSON.
- Persist only through `garage.ts`.
- Small PRs. One task from `TASKS.md` per PR when possible.

## When Grok returns

Read `TASKS.md` top unchecked item. Do not rebase history. Do not rename the product.

## Session log

- 2026-09-13 Grok: repo created, routing + Slide score + speed bands, then 3D HUD / garage / seeded ghosts. Handoff files added for Cursor + Claude.
- 2026-09-14 Owner asked for handoffs so other agents can finish alongside Grok.
- 2026-09-14 Cursor: independently fixed the same P0 build break (PR #1, merged to `main`): broken `esc()` escape map, unused search-highlight stub, `noUnusedLocals`/`noUnusedParameters`, MapLibre calls gated on `isStyleLoaded` via a new `src/lib/mapready.ts`. No product-contract change.
- 2026-09-14 Claude: P0#1 `npm run build` is clean, built in parallel with Cursor's session above before either saw the other's work — same root cause (`esc()` parse error), independently fixed with an inline `whenStyleReady()` queue instead of `mapready.ts`. Also imported the GeoJSON types from `geojson` instead of the global namespace, enabled the same unused-checks, and fixed a trail change only recoloring `route-glow` and not `route-line`.
- 2026-09-14 Claude: UX pass grounded in Mobbin recon of Google/Apple Maps, Grab Driver, Tesla, Transit. Added the next-maneuver banner, a regulatory speed-limit sign, the posted-speed lookahead chip, tappable time chips on each line, camera fit on plan, and a live GPS watch that snaps the marker to the shape. New libs `guidance.ts` and `tracking.ts`. **Scoring contract changed** (see docs/PRODUCT.md): turns are now weighted by type — left 1.8, u-turn 2.4, right 1.0 — because the old `isTurn` range (9-14) silently excluded kLeft(15) and kSlightLeft(16), so left turns were only caught by an English-only regex. Slide scores will shift on left-heavy routes; that is intended.
- 2026-09-14 Claude: merged Cursor's PR #1 (already on `main`) into this branch. Kept this branch's `main.ts`/`smooth.ts`/`tsconfig.json` — a strict superset that already covers Cursor's fixes plus the rest of P0 and the guidance/tracking work above — and dropped `src/lib/mapready.ts` as dead code once nothing referenced it, rather than leave two different style-ready mechanisms in the tree. Adopted Cursor's clean `package-lock.json` (this branch's own copy had been reverted earlier after a test-only dependency leaked into it).
- 2026-09-14 Cursor: owner phone bug — OpenFreeMap dark (`rgb(12,12,12)` land, motorways `#000`) plus a stacked mobile HUD made the map look black after Drop the line. Lifted the night basemap in `src/lib/maplook.ts`, thickened the selected ribbon (glow/case/line/white core), and switched the HUD into Plan vs Drive Mode so the map stays visible between a huge next-turn banner and a compact End bar. First-run “How to Slide” is dismissable (`coachDismissed` in garage). Phone plan is map-first: collapsed **Where to?** pill docked to the bottom (`position: absolute` — a dropped rule had left it in document flow at the top), Home/Work/saved chips in localStorage, locate + compass FABs, flatter plan camera (3D returns in Drive). Waze refs used as direction only — no police, social feed, or ads. Native CarPlay is still a later iOS app. No scoring-contract change.
- 2026-09-15 Cursor: post-plan **route overview** sheet (`data-mode="review"`): big duration + distance, `viaLine()` from Valhalla street names, **Go now** / **Where to?**. Drive no longer auto-starts after Drop the line. Map time chips (Slide / Faster / Alt) polished for the overview — no live traffic coloring. End returns to the overview. Claude follow-up listed in `TASKS.md` (preferred-route, Avoid, leave later, multi-stop, mode switcher, traffic ribbon, CarPlay doc). No scoring-contract change.
- 2026-09-23 Nard: Cloudflare Pages is live at **https://kings-slide.pages.dev** (project `kings-slide` on account `f52402ec949a9f17b451e9ec801a9c68`; alias `https://6b95d219.kings-slide.pages.dev`). Docs-only PR checks the P0 Pages box. Do not redeploy Pages from this agent. No scoring-contract change.
- 2026-09-23 Claude: **VIA skin** — premium night HUD pass. Token + type layer appended to `src/styles.css` (Geist/Geist Mono, near-black surfaces, one accent), copper default `--glow` (existing Garage picks untouched, copper added to swatches), thin-weight numerals, copper maneuver tile, US-style rectangular speed-limit sign, calmer End. New `docs/DESIGN.md` is the style contract. CSS/markup only — no scoring or routing change. Note: `main` did not build before this PR (garage `recents`/`home`/`work` fields referenced in `main.ts` but missing from `GarageConfig`, plus an arg-count error at main.ts:630); this PR adds no new errors and does not touch that code.

- 2026-09-23 Claude: Phase 0–1 docs only. Added `docs/STRATEGY.md`: day-1/day-30 framing, measurable Effort (weighted lefts, signals, merges, speed drops, lane changes), the proposed contract "Slide = least Effort within +10% of fastest" (lands in Phase 3 with a PRODUCT.md update), and a Borrowed / Rejected / Unique table. Found: `npm run build` fails on this branch (17 TS errors: `recents`/`home`/`work` missing from `GarageConfig`, 4-arg call at `main.ts:630`); `rankRoutes()` has no time bound, so a much slower route can win. No scoring-contract change yet.
- 2026-09-23 Claude: owner added a Snap Map / Waze CarPlay direction: a 3D living map with *cars* instead of avatars, Forza vibe. Captured in `docs/STRATEGY.md` ("3D living map layer"): garage car in 3D on Explore, "Miami driven %" glowing driven roads (on-device; now the proposed Phase 5 surprise feature), Effort events drawn on the route, friends' cars deferred to an opt-in presence design. No sponsored pins.

- 2026-09-23 Claude: applied the owner's VIA skin patch (rebuilt from the PDF export; CSS/markup only, adds no TS errors). Ran design recon on the 10-screen VIA canvas and merged it into `docs/DESIGN.md` as a build spec. Main corrections: traffic bars → Effort strips, crowd hazard reports → FL511/FDOT only, no "Report a hazard", Arrival "saved" → pace-ghost delta. Corrected the TS error count to 17 (an earlier note said 13 from truncated output).

- 2026-09-23 Claude: owner asked for a **login** so friends can test and always get back in. Built it on-device (no server, no accounts; HANDOFF rule 4 holds): `src/lib/profile.ts` + `src/hud/login.ts`. First visit: name, car tag, optional 4-digit PIN (SHA-256 hashed, a local lock, not security). Stays signed in across reloads; menu → **Lock Slide** shows "Welcome back"; "Start over" erases every `slide.*` key. Asks for persistent storage and suggests Add to Home Screen (new `public/manifest.webmanifest`), because iOS Safari clears site data after ~7 days unused otherwise. Verified in headless Chromium on an isolated page (create, validation, reload stays in, lock, wrong/right PIN, PIN not stored in plain text). **Found: the app can't start at all today.** `main.ts` imports `sameTrip` and `tripShape`, which `valhalla.ts` doesn't export, so the browser throws on load and nothing renders (blank screen). This is likely the live-site loading bug and is Nard's first fix.

- 2026-09-23 Claude: **Night network look** from the owner's SEKAI reference (see DESIGN.md): warm city-light basemap palette, near-black water, route = wide soft glow + thin white line, alternates as grey hairlines, deeper glass panels, round glass FABs, route time pills as glowing glass cards, live-state dots. New `src/map/you.ts`: the driver now **sees themselves** (the Locate button used to recentre the map without drawing anything). It updates on every GPS fix, is hidden in Drive (the car takes over), greys out after 15 s without a fix, and auto-starts after sign-in only if location permission was already granted. **Fixed a pre-existing bug on `main`: the route line never drew.** All four route layers nested a zoom `interpolate` inside a `case`, which MapLibre rejects, so `route-glow/case/line/core` failed silently. Verified by rendering in headless Chromium. Navigation problems found (not fixed, for Nard): Drive runs a **simulated** car unless Locate was tapped first; the default `cinematic` camera **doesn't follow the car**; the start point falls back to **map center** instead of GPS; off-route only shows a banner, with **no reroute**.

- 2026-09-23 Claude: **Command view**, rebuilt piece by piece from the owner's SEKAI dashboard with only real data. Wide screens (≥1100px): top bar (SLIDE, tabs, search, alerts bell, driver avatar), left rail (Drive overview: drives / off-route / miles over 24h·7d·30d; Smooth score + trend chart; Your trips with smooth % and posted-speed sparklines), a rounded map column (Map / 3D / Satellite switch, clock + Open-Meteo weather card, floating Slide route card, layers / zoom / locate stack), and a right rail (Route intelligence: Slide vs Fastest with the why-line, a Faster option card, arrival accuracy; Drive rhythm bars by hour). Phones: the same panels as a full-screen **Drive insights** sheet from the menu. Swapped out from the reference because they'd be fake data: "Congestion Predicted · AI Analysis", the red traffic map, fleet and passenger counts. **Satellite** is shown as disabled until a licensed imagery source is approved. New trip history (`slide.history.v1`) records a drive on End **only if it ran on live GPS** (≥0.2 mi); the preview car is never saved. Empty states show until then. Verified by rendering in headless Chromium at 1672×940 and 390×844 with a test-only seeded history.

- 2026-09-23 Claude: owner renamed the flat night map skin from "Waze" to **Slide** (`MapSkin` `"waze"` → `"slide"` in `garage.ts`; a saved `"waze"` migrates on load). When the 3D / FLAT / SLIDE skin toggle is built, label it **SLIDE**, never Waze. Owner also confirmed satellite imagery is optional ("just extra"), so the Satellite tab stays disabled with no paid source for now.

- 2026-09-24 Nard: **Phase 2 — app starts, real-location navigation, live on Pages.** PR #10 merged to `main` first (VIA skin, login, night-network look, you-are-here, Command view), then one branch/PR on top (`nard/app-start-real-nav`).
  - **Starts:** restored `sameTrip` / `tripShape`, switched the 4-arg call to `requestFastRoute`, added `coachDismissed` / `recents` / `home` / `work` to `GarageConfig`. `npm run build` passes with zero TS errors. `slide.garage.v1` migrates field by field (`migrateGarage()`): every valid field is kept, a broken one falls back to its default, the pre-migration value is copied once to `slide.garage.v1.backup`, and unreadable JSON is kept in `slide.garage.v1.corrupt` rather than dropped.
  - **Navigation on real GPS:** From defaults to **Current location**, and planning waits up to 15 s for a fix — never the map centre. **Go now** starts `watchPosition`; the simulated car runs only from **Preview drive** (labelled "simulated, not saved", a PREVIEW chip shows while it runs, and it is never written to history). The camera follows the driver in cinematic / chase / top; any pan, pinch or wheel pauses follow and shows **Recenter** (raw pointer events, because the per-frame `jumpTo` cancels MapLibre's own drag before `dragstart` fires). Off-route (>60 m) for 8 s while moving (≥3 mph) re-plans from the fix with the same `rankRoutes()`. **Arrival** screen at ≤40 m (or ≥99 % along with ≤0.05 mi left) saves the trip. Location denied / unavailable / timeout / non-https each have their own message with **Search a start point instead** + **Try again**. Trip distance is now the GPS distance actually driven, not route progress (it survives a reroute).
  - **Bug fixed — posted speeds:** Valhalla already returns mph when asked for `units: miles`, and `buildBands()` converted again, so a posted **30 showed as 19** on the limit sign and "Hold X → Y" chip. Fixed; kilometre responses still convert. Scoring weights unchanged (speed variance never used the converted value), so no PRODUCT.md contract change.
  - **Installable:** PNG 192/512 + maskable 512 + 180 px apple-touch icon, manifest `display: standalone`, and a shell-only service worker (`public/sw.js`: network-first HTML, cache-first hashed assets; **never** caches routes, search, weather or tiles). Chrome's `Page.getInstallabilityErrors` on the live site returns **no errors**; SW active and controlling after reload. Google Fonts no longer block first paint, and a static SLIDE boot skeleton paints before the JS. MapLibre is split into its own long-cached chunk (app JS is 76 kB / 25.7 kB gzip; MapLibre 1,053 kB / 283 kB gzip).
  - **Live:** https://kings-slide.pages.dev (Pages project `kings-slide`, account `f52402ec…`), app bundle `assets/index-B2z6p5YW.js`, deploy `https://4cb68188.kings-slide.pages.dev`. The workers.dev preview (Worker `slide`, static assets from `dist`, config shape from the earlier preview's `wrangler.jsonc`) was refreshed to the same build: https://slide.kingleonardjr19.workers.dev. Wrangler needs Node ≥22; the box has Node 20, so it was run via `npx -p node@22`.
  - **Load time, measured** (headless Chromium on the box → Cloudflare edge, cache disabled, median of 3; `slide-map-idle` = first full map render, a `performance.mark` now in `main.ts`):

    | Profile | First paint | HUD/login ready (DCL) | Map style loaded | Map fully rendered |
    |---|---|---|---|---|
    | Desktop 1440×900, no throttle | 0.14 s | 0.32 s | 1.02 s | 1.79 s |
    | Phone, 9 Mbps / 85 ms RTT / 4× CPU ("good 4G", custom) | 0.35 s | 1.02 s | 2.23 s | 2.99 s |
    | Phone, Lighthouse Slow 4G (1.6 Mbps / 150 ms / 4× CPU) | 0.63 s | 2.48 s | 5.06 s | 5.82 s |

    Before this PR (old live build `index-DsG32Gag.js`, same method): first paint 0.35–0.42 s desktop / 0.51–0.53 s Slow 4G; that build had no map-ready mark, so its map time isn't comparable. **The "<3 s map on 4G" target is met on good 4G but not on Slow 4G** — the 283 kB gzip MapLibre bundle plus the OpenFreeMap style → tiles chain is the floor. Next lever: show the login/HUD before MapLibre loads (dynamic import), then self-host or pre-cache the style.
  - **Verified** with Playwright against the live site (29/29 checks, 0 console errors; `qa-results.json`): login first visit, tag seeds garage, reload stays in, Lock → Welcome back, Drive insights opens/closes, From = Current location, Preview not saved, Go = live GPS (speedo MPH), camera follows, pan → Recenter → resumes, End saves a trip, arrival screen + save, trip in Your trips, reroute after 8 s off-route, denied and timeout messages (no map-centre fallback), laptop three-column Command view, canvas = map column (740×802), plan card clear of the Map/3D switch (open and closed), map resizes with the window.
  - **Recording** (`/workspace/slide-live/slide-demo-phone.mp4` 3 m 53 s, `slide-demo-laptop.mp4` 19 s, chapters in `slide-demo-chapters.txt`): **emulated phone** (Chromium 390×844, touch, iPhone UA) with **simulated GPS** (Playwright `setGeolocation` stepping along the real Valhalla route Mary Brickell Village → Bayside Marketplace at ≈25 mph) against the live site. It is **not** a real-device recording. In that run: map rendered in 1.95 s (no throttle), reroute landed 15.4 s after leaving the line (≈5 s to get 60 m off + the 8 s timer + ≈2 s routing).
  - **Still broken / not done:** a real iPhone + Android test and **Add to Home Screen** (standalone launch, stays signed in) still need a human with the devices. The public Valhalla server usually returns a **single line** in Miami (both costings give the same trip on 7 of 8 test pairs), so a **Faster card rarely appears**; a single-line plan now shows one Slide chip and "Fastest is also the smoothest line we found" instead of nothing. Phase 2 items not done: Slow-4G map under 3 s, fetch retry, offline/no-route sheet, `main.ts` split. Ghosts are still seeded simulations (known gap).

- 2026-09-25 Claude: **Phase 1 "Better routes", part 1** (branch on top of PR #11, free providers only).
  - **3+ routes:** Slide, Fastest and No-tolls costings are requested in parallel and de-duplicated (max 4). Found why Faster almost never appeared: the code sent `alternatives: true`, but Valhalla's option is `alternates` (a count), so it was silently ignored. It now sends `alternates: 2` and reads both response keys.
  - **Slide route contract implemented:** smoothest within +10% of fastest (PRODUCT.md updated). Tags: Slide pick / Fastest / No tolls.
  - **Tolls:** from Valhalla `summary.has_toll` → "Has tolls" / "No tolls" on bubbles and in the review line. No prices (no price source yet).
  - **Route options sheet** (sliders button): avoid tolls / highways / ferries, saved in the garage (`avoid`), applied to every plan and reroute.
  - **Add stops:** up to 5, reorder by dragging the grip (pointer events, works on touch), remove with ×. Each stop drops off the list once reached, so a reroute never sends you back.
  - **Map:** tap a route line (invisible 28 px hit layer) or its bubble to select it. The selected line draws on top. Bubbles sit where routes diverge and never overlap on screen (re-laid out after zoom).
  - **Honest ETA:** the review sheet says "Typical time · no live traffic yet". This is why Slide said 31 min where Google said 42 for Fort Lauderdale → 9601 Collins Ave.
  - Added Vitest (`npm test`, 18 tests) and `npm run typecheck`. Verified end to end in headless Chromium with **test-only fake Valhalla/Photon answers** (the container can't reach the real services): login → search → 3 bubbles with tags → tap to select → avoid tolls re-plans → add stop sends 3-point routes → setting persists → no page errors. **Not verified against the live Valhalla server** (especially `alternates` and `has_toll`); check on the deployed site.
  - **Not done, needs the owner (traffic-aware ETAs):** see "Traffic provider decision" below.

- 2026-09-25 Claude: **SEKAI Live Network pass on the desktop Command view** (owner's HTML, ≥1100px only; phones unchanged, verified: 0 desktop-only elements visible at 390px, Insights sheet identical). Adds stat tiles with week-over-week trends, a 7-day minutes sparkline, a bell + right-rail **alert list** with severity dots (posted-speed drops, tolls vs Avoid tolls, rain, off-route), and a **Navigation intelligence** card with a one-tap **Switch** and real typical-time savings. The HTML's fake parts (predicted congestion, fleet, ETA jitter) are not copied; congestion is an honest "needs a live traffic provider" line. Trips now record `tollRoad`. 28 unit tests; e2e in headless Chromium with test-only fixtures (desktop + phone).

- 2026-09-25 Claude: **Removed bot data.** The seeded ghost "drivers" (NOVA, KITE, VEX and a pretend "you") that appeared on every route as if they were real people are gone; `seedGhosts()` is deleted, no ghost cars are drawn, and the GHOST timer stays hidden until a real ghost exists. Deleted `preview/index.html` (an old standalone demo page with a "Demo Miami" button and its own made-up scoring; it was never part of the build). Test fixtures stay, but only inside test files.
- 2026-09-25 Claude: **Profile section** (`src/hud/profile.ts`): menu → Profile on phones, the avatar on laptops. It shows the driver header (name, car tag, "driving with Slide since"), all-time drives, miles and average smooth score from real trips, editable name and tag, and **My car** (make, model, year, fuel, SunPass; never plate or VIN). It also has Home/Work with Clear, and privacy buttons: Lock, Clear my drive history, and Erase everything on this phone. **Friends & followers** is shown but says it's not available yet: it needs accounts and a presence/privacy design, which the owner has to decide on (see TASKS). All data stays on the device. 31 unit tests; e2e in headless Chromium (phone: save car → reload keeps it; preview drive draws 0 ghost cars; laptop: avatar opens the sheet and Escape closes it).

- 2026-09-25 Claude: **Everything merged onto one line.** Owner asked to merge all open work before using Slide for work.
  - **#11** (Nard, real GPS) and **#12** (routes, dashboard, profile) → `main`.
  - **#5** (Grok's `src/lib/timeline.ts`, posted-drop marks) merged into #12. It isn't wired into the UI yet.
  - **#7** closed: superseded by #11's identical build fix.
  - **#9** (Cursor's `main.ts` split) closed: it was written against the app before real GPS, login, routes and the dashboard. Its one-retry `net.ts` idea is ported into `fetchJson` (network / timeout / 429 / 5xx only, 700 ms pause). The file split is still a TASKS item.
  - Planning is now gentler on the public Valhalla server: one variant request at a time, stop at 3 distinct lines, and trace calls in sequence with a timeout. Verified that a 429 is retried and the plan still draws 3 routes.
  - 33 unit tests; e2e routes / dashboard / profile all pass on the merged tree.

- 2026-09-25 Claude: **Radar, driver reports, accounts, friends & followers** (owner approved Supabase and the radar).
  - **Radar** (`src/hud/radar.ts`): a heading-up mini map with a sweep, 0.5 / 1 / 1.5 mi rings and colored blips, showing real items only:
    - driver reports: police, crash, hazard, closure, jam
    - FL511 official incidents, closures and roadwork
    - **Report** button: five big one-tap choices at your current spot.
    - **Heads-up banner + vibration** once per item when police, a crash, a closure or a hazard is reported within 0.8 mi ahead.
    - **Nearby list** with Still there / Not there.
    - It never suggests changing speed, and police are always worded "reported by drivers".
  - **Database** (`supabase/migrations/…`): profiles, follows, reports and votes, all under RLS.
    - Reports are only readable through `reports_near()`, which returns no reporter.
    - Rate limit of 5 per 10 min; duplicates within ~150 m merge as a confirm.
    - Expiry: police 30 min, crash 60, closure 120, jam 20, hazard 45. Confirms extend it; two "not there" votes remove it.
    - `delete_my_account()` cascades.
    - Tested in PGlite with Supabase-style auth stand-ins (dedupe, no reporter column, own-vote ignored, 2 clears remove, rate limit, signed-out refused, friend counts).
  - **Accounts** (`src/hud/social.ts` in Profile): sign in with an email code, pick a @handle, and choose to show your car or not (off by default).
    - Friends / Followers / Following tabs, driver search, follow / unfollow / remove follower.
    - Sign out and Delete account.
  - **FL511** via a Pages Function holding the key server-side, with a shared 60 s edge cache.
  - **Everything is off until configured:** the app runs exactly as before without the env vars.
  - **Verified:** 45 unit tests. E2E in headless Chromium with test-only Supabase / FL511 stand-ins and a fake phone driving north: radar blips, Nearby list, vote sent, report sent, banner + vibration while driving, friends lists. The regression runs without accounts all pass.
  - **Not verified against live services:** real Supabase, and the FL511 response field names (the mapper reads fields defensively; check the first real payload).
  - **Not built:** live bus/train positions (GTFS-realtime, next), speed-camera locations, and friends' live positions on the map (needs the presence design).

- 2026-09-25 Claude: **Add-ons finished: cameras, buses & trains, friends on the map.**
  - **Enforcement cameras:** `highway=speed_camera` nodes and `type=enforcement` relation devices (speed, red light, average speed) from OpenStreetMap, via `/api/cameras`. Overpass is queried once per ~11 km tile and cached for 24 h at the edge. Purple blips; a heads-up only within 0.3 mi ahead ("Red-light camera ahead"), with no speed advice. The Nearby list says coverage is only as complete as OSM.
  - **Buses & trains:** `/api/transit` reads GTFS-realtime VehiclePositions feeds listed in the `TRANSIT_FEEDS` Pages secret. There's a hand-written protobuf decoder (no dependency), tested against byte-exact feeds built to the spec's field numbers. Positions older than 180 s are dropped. Blue bus and teal train blips, which never trigger alerts. No feed URL is hard-coded: wrong or retired URLs just drop that agency.
  - **Friends on the map:** new migration `…_friend_presence.sql`. The server rounds positions to 2 decimals (~1 km), only mutual friends can read them, rows expire after 15 min, and stopping deletes the row. Tested in PGlite. It's off by default: Profile → "Share my rough location with friends". A pill "Sharing rough location with friends · Stop" shows while sharing. Friend spots appear as a ~1 km circle with a name chip while planning and are **hidden while driving**. Sign-out also stops sharing.
  - **Verified:** 54 unit tests. E2E with test-only stand-ins covering the camera, bus and train blips, the Nearby list, friend spot shown when planning and hidden when driving, share sent already rounded, pill Stop → `stop_presence` and the setting saved off. Regression runs without accounts all pass.
  - **Not verified against the live services.**

- 2026-09-25 Claude: **Nothing simulated.** Owner asked for real data only, so the "Preview drive" button and its simulated car (`chasePoint`, `previewDrive`, the PREVIEW chip) are removed. Go always uses live GPS; with no fix the car is hidden and the speed shows "—". Scanned the production bundle for leftover fake or demo strings: none (the only hit was the HTML word `novalidate`). PR #13 merged.

- 2026-09-25 Claude: **Handed to Nard.** The owner asked about FL511. It covers official incidents, closures and roadwork only; police, traffic speeds, transit, cameras and routing come from the other sources listed above. Rewrote **What already works** and **Next for Nard** to match `main` after PR #13: turn on the data, verify against the real services, stability, then features. Removed the stale Claude follow-up list, since those items are done or folded into Nard's list.

- 2026-10-04 Claude: **Supabase project created.** King asked Claude to set up Supabase through the connector as its own project and to hand the rest to Nard. Created `slide` (us-east-1, ref `zmriqctjkhwmhuvxyhdd`) and applied the schema in six small migrations, because the connector times out on large payloads and on any statement containing `delete`. Two functions, `stop_presence` and `delete_my_account`, are left for Nard to paste (SQL in Owner setup). The advisor warnings are the intended RPC design. Nard now does Auth settings, Cloudflare env, FL511, transit feeds and the redeploy.

- 2026-10-04 Claude: **LUMEN themes.** Added the owner's newest reference ("LUMEN", a SEKAI follow-up) on top of the existing Command view. It's a theme switch for **Night / Ember / Sand**: in the desktop top bar, and in Garage → Theme on phones. It's saved in the garage as `look` (default night, migrated safely) and applied with `[data-look]` on `<html>`. Each theme sets the panel/glass/text tokens and its own basemap palette (`liftNightBasemap(map, look)` in `src/lib/maplook.ts`). Desktop cards got the LUMEN glass (a top-lit gradient, hairline highlight, blur on the map controls). Kept the Slide name and real data only (no "demo data"). Sand is a warm low-light theme, not a daytime light mode: the night HUD stays the default (product rule 6). 67 tests pass; browser-checked all three themes on desktop and on phone, with no console errors.

- 2026-10-04 Claude: **Clean pass (Apple-grade restraint).** The owner asked for design recon + magi mode on the premium-glass-kit. Recon (Mobbin): Apple Maps uses one large sheet radius, filled search fields, flat pill buttons, and map controls merged into one capsule; Mintlify, Copilot and Plain use few borders, a single accent and gray hierarchy. Magi conclusion: premium here comes from **subtracting**, because five stacked style layers had left 15 different corner radii and glows on everything. Added one final CSS layer, "Clean pass" (end of `src/styles.css`):

- 2026-10-04 Claude: **Merged vibe.** The owner asked to keep Slide's original identity inside the clean pass. Restored the copper (Garage glow) underline with a soft glow on the active tab, a soft accent halo on the main action, and uppercase mono HUD labels (FROM). The SLIDE wordmark, mono tag chip and glowing route were never changed. DESIGN.md now lists these as identity elements the clean rules must not remove.

- 2026-10-04 Claude: **Rides (pick your car).** The owner wants a Google Maps-style car marker plus Hot Wheels-style customisation and a game feel, with future game collabs in mind, as a Waze competitor. Added `src/lib/vehicles.ts`: six original top-down designs (Slipstream hypercar, Brawler muscle, Pocket hatch, Ridge SUV, Hauler pickup, and Classic, the original Slide wedge). Each has paint, the Garage glow as accent (underglow and trim) and a livery (Solid / Stripes / Fade). The Garage now opens with a **showroom**: the selected car idling on a glowing stage, a card per ride, livery pills, and a 10-colour paint palette. Your ride is the drive marker, and in Plan/Explore the blue dot turns into your car while you're moving (like Google Maps). Saved as `vehicle` / `livery` in the garage, with migration. Every entry has a `pack` ("Slide Originals"): a licensed collab pack is just new registry entries, and **no real brands or game cars without a signed licence**. 70 tests pass; browser-checked with no page errors.

- 2026-10-04 Claude: **Finish pass.** Walked every screen in a headless browser (search, route review, route options, drive, menu, desktop review), faking Photon/Valhalla in the test harness only. Fixes:

- 2026-10-04 Claude: **Design research handed to Grim, Nard and Leon.** Wrote `docs/DESIGN-RESEARCH.md`. **Root cause** of the repeated UI mistakes: `styles.css` is 6 stacked override layers, with 16 radii, 67 raw hex colours, 30 font sizes and 19 `!important`. It also has Mobbin research (Waze, Google Maps, Apple Maps, dashboards, game/reward apps) with links, a full gap list (voice guidance missing, lanes, route cards, report grid, place card, offline states, game layer, 3D ride, share card) and a build order per person. Copied the owner's premium-glass-kit into `design/premium-glass-kit/` as the token source.
  - Desktop: the radar and Report button overlapped the route sheet. They now sit top-left of the map.
  - The radar was still a separate green theme. It's now graphite glass with the Slide accent sweep.
  - Phone drive: the speed chip overlapped the turn card. The stack is now turn card → chip → radar.
  - Menu copy: "Save destination as Home/Work".

  No page errors.
  - SF Pro via the system font on Apple devices (Geist elsewhere) and tabular numerals
  - a radius scale: 28 sheets, 18 cards, 12 inner, pills for controls
  - flat pill buttons with 44 px+ targets, and filled borderless inputs
  - no decorative glow
  - thin display numerals on the desktop dashboard only (driving numbers stay heavy so they read at a glance)
  - the desktop map controls as one capsule
  - `prefers-reduced-motion` respected

  No layout or logic changes.

- 2026-10-04 Nard: **Data turned on (part), verified on a preview.** `kings-slide` is a Direct Upload Pages project, so `VITE_SUPABASE_URL` now lives in a committed `.env.production`; dashboard env vars would never reach the bundle. `TRANSIT_FEEDS` is set as a production + preview secret with the three feeds that work without a key: Broward (105 buses), Tri-Rail (6 trains) and Brightline (8 trains), each fetched and decoded with our decoder. Miami-Dade needs a Swiftly key. Production (2026-09-24 build) predates the Functions, so `/api/*` there returns HTML. On a preview of `main` (`https://nard-verify-main.kings-slide.pages.dev`), `/api/transit` returned all three agencies `ok` (90 BCT + 2 Tri-Rail + 1 Brightline within 20 km of Fort Lauderdale), `/api/incidents` returned `configured:false` (no FL511 key yet), and `/api/cameras` returned "Overpass unreachable" because public Overpass answered 504 at the time. Then the anon key (`role: anon`) went into `.env.production` and production was redeployed from this branch's tree (main + `.env.production`).
- 2026-10-04 Nard: **Sign in by tapping the emailed link.** Supabase won't let us edit the Magic Link template (to add `{{ .Token }}`) without custom SMTP, so the email only has a link. `sendCode()` now sets `emailRedirectTo` to the current page. On return, `authReturn()` spots `#access_token=…` (implicit flow, the supabase-js default) or `#error=…`, the client is created with `detectSessionInUrl` on for that load only, the tokens are stripped from the address bar, and Profile opens on Friends & followers (signed in, or "pick your handle"). An expired link shows "That sign-in link has expired…". The code box stays as an option ("Or enter the code, if the email shows one"). Redirects: GoTrue accepts any `redirect_to` on the Site URL's host, so production needs no Redirect URL entry. Previews (`*.kings-slide.pages.dev`) need `https://*.kings-slide.pages.dev/**` in Auth → URL Configuration → Redirect URLs, or their links land on production. Limit: on iPhone the link opens in Safari, so a Home Screen install is signed in only if the code is entered there (needs `{{ .Token }}` → custom SMTP).

- 2026-10-04 Nard: **Block 3 stability: offline/no-route sheet + faster first load.**
  - **Try again sheet** (`#net-sheet`, wording in `src/plan/failure.ts`): it says which of these happened: offline ("You're offline", which turns into "Back online" when the connection returns), no road between the points (Valhalla 442/170/171/443; `fetchJson` now keeps Valhalla's error code instead of a bare "400"), rate-limited (429), or server unreachable. It covers planning and search; before this, search failures silently closed the list. **Try again** re-runs the same plan or search.
  - **HUD + login before MapLibre:** new entry `src/boot.ts` paints the HUD (`src/hud/shell.ts`) and the login gate from an 8 kB chunk, then dynamic-imports `main.ts`. A small Vite plugin adds `modulepreload` for `main` + `maplibre`, so they still download from the first byte. `main.ts` waits on `driverReady` instead of calling `ensureSignedIn`. The service worker is registered from boot; the old `load` listener in main would have never fired once main loaded late.
  - **Map style warm-up:** `index.html` preloads the style JSON + TileJSON. boot fetches the style and hands the object to MapLibre (no second request), and preloads the sprite + first glyph range once the MapLibre file has downloaded, so they don't compete with it. Phones start at the flat plan pitch they eased to anyway. Geist fonts load after the first map render (or 4 s).
  - **`public/sw.js`:** pre-caches the style JSON + TileJSON on install, and serves style / TileJSON / sprite / glyphs stale-while-revalidate (`slide-mapstyle-v1`). It still never caches vector tiles, routes, search or weather.
  - **Measured** (headless Chrome on the box → Cloudflare, iPhone 13 emulation, Lighthouse Slow 4G = 1.6 Mbps / 150 ms / 4× CPU, cache disabled for cold; median of 5): HUD/login **2.66 s → 0.79 s**; map style loaded 5.18 s → 4.16 s; map fully rendered **5.97 s → 5.03 s**. Repeat visit (SW + HTTP cache): HUD 0.60 s → 0.19 s, map rendered 2.56 s → 2.57 s (under 3 s both before and after). Good 4G (9 Mbps / 85 ms / 4× CPU, median of 3): HUD 1.19 s → 0.45 s, map rendered 3.26 s → 2.86 s.
  - **Why cold Slow 4G is still ~5 s:** it's the bytes. MapLibre is 277 kB, sprite@2x + glyphs 160 kB, and downtown-Miami z14 vector tiles are ~60–90 kB each (4–6 on screen). That's ≈ 800 kB, or ≈ 4 s at 1.6 Mbps before any CPU time. Under 3 s on a first visit needs fewer bytes: self-hosted, slimmer tiles or a 1× sprite.
  - Verified on the preview with headless Chrome: login gate first, then the HUD; returning driver goes straight in; Photon down → "Can't reach search" → Try again → real suggestions; a test-only Valhalla 442 → "No drivable route found"; offline → "You're offline" → "Back online" → Try again → real Valhalla route (review, 3 min); the email-link return still works; 0 page errors. The `wood-pattern` sprite warning is OpenFreeMap's and also shows on production.

- 2026-10-04 Nard: **Merged #16 → #17 → #18 and redeployed production** from `main` @ `d6b83e8` (build clean, 62/62 tests). Deploy `https://c16f0590.kings-slide.pages.dev`, live at https://kings-slide.pages.dev. Live checks in headless Chrome: login gate → HUD → map renders, 0 page errors; accounts on (Profile shows "Email me a sign-in link"); an email-link return with an expired or bogus token gives the right message and a clean URL; offline / no-route / search-down sheets and Try again work, ending in a real Valhalla route. `/api/transit` returned 104 vehicles near Fort Lauderdale (all 3 agencies ok). `/api/incidents` is `configured:false` until the FL511 key. `/api/cameras` now answers from Overpass (0 cameras mapped in the downtown-Miami tile).
- 2026-10-04 Nard: **Official incidents without a key** (King approved). `/api/incidents` now merges two free feeds, fetched server-side with a 7 s timeout and a 60 s edge cache each, and each source fails on its own: **FDOT DIVAS** (the ArcGIS layer behind FL511's map; queried for Palm Beach → the Keys) and **Miami-Dade Police** traffic calls (`traffic.mdpd.com/api/`, which has no CORS, so server-side only). FL511 is still used if `FL511_API_KEY` is set. The response is `{configured, sources:[{source, ok, count, error?}], items}`, newest first. Mapping: DIVAS crash → crash, roadwork → roadwork, congestion/backup → jam, "all lanes closed" → closure, disabled vehicle and the rest → hazard. MDPD accident/hit-and-run → crash. MDPD times are Miami wall-clock and are converted with EST/EDT. MDPD items are labelled "dispatched call": they are crash calls, never police positions. Live on the preview at 10:30 ET: FDOT 10 events (Palm Beach 9, Monroe 1; none in Miami-Dade/Broward at the time), MDPD 5 crash calls. In headless Chrome with GPS at NW 135th St / NW 7th Ave, the radar showed 2 MDPD blips and the Nearby list showed them; at I-95 / Forest Hill Blvd it showed the FDOT crash. FDOT WZDx work zones are not added (later).

- 2026-10-04 Grim: **PR 1 — design system rebuild.** Deleted the 6 stacked CSS layers. `src/styles/tokens.css` is the only hex file (kit Night / Ember + Slide Sand, mapped to `[data-look]`). `src/styles.css` is tokens → base → components → screens. `--glow` stays the Garage accent. Metrics on `main` before → after: radii 25 → 6, unique raw hex 68 → 0 outside tokens, font sizes 31 → 9, `!important` 24 → 0. Identity kept (spaced SLIDE, mono tag chip, uppercase mono HUD labels, Garage glow, glowing route, `vehicles.ts` rides, night default). Empty teammate slots added in `src/hud/shell.ts` (see below). No voice/lane/data or game-layer logic.
- 2026-10-04 Grim: **PR 2 — screen pass.** Review `#route-carousel` from real ranked routes only. Drive: `#speedo` bottom-left, `#drive-report` bottom-right; `#lane-strip` still empty for Nard; `#drive-mute` is a working mute button that sets `document.documentElement.dataset.voice` and fires `slide:voice-mute`. Report grid uses glass icons + a subtype step, then Send / Later (RPC still only gets the kind). `#place-card` (name, address, Save, Go) after a real search pick. Fail sheets: `#loc-banner` + `#loc-title` for denied / unavailable / timeout / insecure; `#net-sheet` already covers offline / no-route. Arrival is a trip card with `#arr-share` (native share, no address) and `slide:share-trip`; `#arr-xp` / `#share-card-mount` stay Leon's. Empty states use `src/lib/empty.ts` instead of "—". Tokens/components only.
- 2026-10-04 Nard: **Lane strip on Grim's #35 drive layout.** Based on `grim/screen-pass-c69a`. `#lane-strip` unhides only with real Valhalla `lanes` within 0.75 mi. Child arrows use existing tokens (`--glow`, `--fill-07`, `--fs-xl`, `--radius-md`) in the one stylesheet — no override layer. Drive chrome stays #35: speedo bottom-left, Report bottom-right.
- 2026-10-04 Nard: **Speech hooks Grim's #35 mute, does not own the button.** Based on `grim/screen-pass-c69a`. `listenVoiceMute` follows `slide:voice-mute` `{ muted }` and `html[data-voice]`, cancels speech when muted, and writes `slide.voice.v1` to match. No `mountMuteToggle`, no second button, no click handler on `#drive-mute`. `startVoice` on Go now re-reads the attribute.
- 2026-10-04 Grim: **PR 3 — polish.** From `main` @ f16ac7d (`grim/polish-c69a`). Desktop drive: `#maneuver` sits in a reserved top row between `.cmd-seg` and `.cmd-clock` (`.cmd-wx` hides in drive); `.cmd-stack` lifts to `128px` so End is not covered. Empty HUD numbers use `.is-empty` (body-large / `--muted` / nowrap) via `setMaybeEmpty()` — `EMPTY` wording unchanged. Unsigned limit sign draws `--` (`postedSignText()`), never `EMPTY.posted` ("No sign"); sign is a fixed 56×72 with `clamp()` type. Turn instruction may wrap two lines (`-webkit-line-clamp: 2`); distance and empty `Next turn` stay one line. `#lane-strip` top is unchanged. Sand land/water/roads and `[data-look=sand]` surfaces are warmer and lighter; Ember untouched. Did not move `#lane-strip` or touch voice/lane/Leon slots.

- 2026-10-05 Cursor: **Address search.** King typed `1020 NW 6th Ave, Fort Lauderdale, FL` and Drop the line still said "Set a destination." Two stacked bugs: (1) `plan()` only used a pin from a tapped suggestion, so raw text never became a map spot; (2) Photon is POI-first and returned the fire station on Northwest 6th Avenue, not house 1020. `src/lib/geocode.ts` now resolves typed text on Enter / Drop the line (Photon house-number match → Nominatim → US Census), shows suggestions while typing, and says "No match, try adding the city" instead of the red "Set a destination" once the box has text. `/api/geocode` proxies Nominatim with `Slide/1 (+https://kings-slide.pages.dev)` at 1 req/s. `SearchHit` gained optional `housenumber` / `source`. No scoring-contract change.

- 2026-10-05 Cursor: **Live traffic layer + incident icons** (Pages Functions, not a standalone Worker). `/api/traffic/*` proxies TomTom when the **Pages project secret** `TOMTOM_API_KEY` is set: relative vector flow tiles, Incident Details, Flow Segment Data along the selected line. Missing key: flow hidden, one console info, no fake colours. Map pins for FDOT / Miami-Dade / driver reports (and TomTom when keyed). Mobile bug: official incidents only lived on the radar disc, and the disc stayed hidden until GPS — pins now load from the map centre. Garage **Live traffic** toggle (on by default). Refresh ~2 min. Drive / review / Command show a real summary and add delay to the ETA when samples exist. Did not touch the speed sign or next-turn banner (Grim #40). `--flow-*` and `--kind-*` retuned so G/Y/R and pins read on Night gold roads, Ember rust/orange roads, and Sand pale-gold motorways; flow lines get a `--flow-case` hairline.

- 2026-10-05 Nard: **TomTom data (search, traffic ETA, speed limits, incident details).** Branch `nard/tomtom-data` from `main` @ `7a2dbd5`. All TomTom calls stay in Pages Functions (`TOMTOM_API_KEY` never a `VITE_` var). (1) `/api/geocode` + `/api/suggest` try TomTom Fuzzy (typeahead on suggest, bias `lat`/`lon`) first; miss / error / search budget ≥ ~1,500/day falls through to Photon → Nominatim → Census. Client debounce 350 ms, min 3 chars, AbortController cancels stale suggests. (2) `GET/POST /api/traffic/route` is TomTom Routing `traffic=true` + optional `sectionType=speedLimit`. `fetchTrafficRoute()` in `src/lib/tomtom-route.ts` is the contract Leon's `reroute.ts` can call — no reroute UI in this PR. Review/drive ETA prefers Routing delay; flow-segment along-route is the fallback. (3) SpeedLimit sections overlay the existing `#limit` sign when present; Valhalla bands stay when TomTom omits them (free-tier may not send sections). (4) `/api/incidents` merges TomTom Incident Details and dedupes vs FDOT/MDPD (~180 m, same kind; official pin kept, TomTom `+N min` folded into detail). Daily budget counter (~1,500 search / 2,500 non-tile). Cache: search 30 min, incidents 45 s, routing 15 s — TomTom terms only allow honoring Cache-Control, not a result database. Attribution `© TomTom` on TomTom suggests, live-traffic notes, and the existing flow layer. No scoring-contract change.

- 2026-10-05 Cursor: **Persistent accounts (Supabase email OTP + magic link, not D1).** King was getting logged out. Root cause: the session lived in Safari-only storage, and iOS Home Screen apps have their own jar (cookies included), so a cookie bridge cannot move a Safari login into the installed app. Fix: email a 6-digit `{{ .Token }}` plus the link; the driver types the code in whichever app they are in (`verifyOtp` type `email`); that app gets the session and `persistSession` / `autoRefreshToken` keep it. Magic link stays for Safari / desktop. Sign in / Create account + a dedicated code screen. Home/work/history/ghosts/XP keyed to `auth.uid()`. **No D1. No new SQL.** Nard: paste the Magic Link template in Owner setup, confirm Site URL + Redirect URLs, redeploy. Verify on https://kings-slide.pages.dev from the Home Screen by typing the code.

- 2026-10-04 Leon: **Game layer 1 (logic only).** Branch `leon/game-core`. Per-trip smooth score from real GPS speed / heading / timestamps and posted limit when present (`src/lib/game/smoothScore.ts`). Missing signals are skipped, never faked. Faster driving never raises score or XP; time over the limit zeros that segment. XP/levels use `xpAtLevel(n) = 40·(n−1)·n` and trip XP = smooth-miles × 10 + a score-only bonus (`src/lib/game/xp.ts`). Tiered badges (First Line, Glass Line, Soft Pedal, Night Owl, Long Slide, Sign Reader, Causeway) in `src/lib/game/badges.ts`. Unlocks: Nimbus at level 5, Glider at Night Owl silver, Halo / Dusk liveries via badges — starter six + Solid/Stripes/Fade stay free so the Garage picker is unchanged. Progress is `slide.game.v1` in localStorage (wiped by `eraseDeviceData`). `useGameProgress()` is the hook for Grim's arrival XP/badge slot, share-card mount, and 3D stage. Drive loop records samples and commits next to history; no CSS or screen layout. API in `docs/GAME-LAYER.md`. Later: Opal stage + 3D car, share card UI, opt-in friends leaderboard.

- 2026-10-04 Leon: **Game layer 2 (share card + local board).** Branch `leon/share-card` stacked on `leon/game-core`. `src/lib/game/shareCard.ts` paints `TripAward.shareCard` plus ride/livery names onto a 1080×1350 PNG (offscreen canvas). Theme reads `--bg` / `--surface` / `--text` / `--muted` / `--glow` / `--line` when Grim's tokens exist, else a neutral night palette. `mountShareCard(el)` is the preview for Grim's slot; `shareTrip()` uses Web Share with a PNG file and falls back to download. No addresses, coords, map tiles, or times of day. Weekly board (`src/lib/game/leaderboard.ts`) is local only: Mon–Sun buckets, opt-in default OFF, `rankWeek` does not invent friends. Future backend sync contract is in `docs/GAME-LAYER.md`. No CSS or screen-layout edits.

- 2026-10-04 Leon: **Game layer 3 (wire Grim slots).** Branch `leon/game-wire` rebased onto Grim `grim/screen-pass-c69a` (PR #35, which sits on #29). Fills `#arr-xp`, `#share-card-mount` (inside `#arrival`, above `.arr-actions`), `#car-stage`. `#arr-share` is the only Share button; `slide:share-trip` calls `shareTrip(lastAward().shareCard + ride)`. `#arr-ride` stays Grim's 2D car. Unhide with `el.hidden = false`. Token-only CSS. `#g-board` Garage toggle (default off). Preview: `window.slidePreviewGame`. Stack: #29 → #35 → this PR → `leon/car-models` #37.

- 2026-10-04 Leon: **3D car models.** Branch `leon/car-models` on `leon/game-wire`. Replaced the box-and-stripes stage meshes with original lofted hulls in `src/lib/game/carMeshes.ts` (starter six + Nimbus + Glider, each a distinct silhouette). Liveries are materials (Solid / Stripes / Fade / Halo / Dusk). Soft studio lights + ground shadow. Still lazy `three`, no model files, no licensed brands, idle spin respects `prefers-reduced-motion`. No Grim layout CSS. Preview: `window.slidePreviewGame.ride(id, livery)`.
- 2026-10-04 Leon: **Car-stage review fix (PR #37).** Removed the under-glow slab so stripes stay on body UVs only (`liveryU` is paint on the underside). Slipstream spoiler sits on the deck with body-colored struts. `deepenHull` + `hullLift` (rocker at `wheelR * 0.34`) tucks tires into side arches; wheels are tire + sidewall + rim dish. `frameCar` now fits the AABB to ~70% at a low 3/4 front (no longer uses length vs vertical FOV). Soft dual-blob contact shadow. `dataset.stageHold` still pauses spin for shots.

- 2026-10-06 Nard: **Sign-in is username + password (no email).** King: "Just remove the login for now and let people use a username and pw." Branch `nard/username-password-auth`.
  - Kept Supabase Auth so the uid (garage `slide.garage.v1.<uid>`, per-account keys, follows/friends, RLS) is unchanged. `src/lib/account.ts`: `normalizeUsername` (3–20 of `a-z0-9_`, lowercased, leading `@` dropped), `usernameToEmail` → `<username>@users.slide.local`, `usernameFromEmail`, `passwordProblem` (8–72 chars; bcrypt ignores bytes past 72), `signUpWithUsername` (`auth.signUp`, username also in `user_metadata`) and `signInWithUsername` (`auth.signInWithPassword`). `.local` is RFC-reserved and on Supabase's mailer blocklist, so no email can ever be sent to these addresses.
  - Errors in plain words: taken username, "Wrong username or password." (also for unknown usernames, so names can't be probed by error text), password too short, rate limit, no connection. If Supabase still has **Confirm email** on, sign-up gets no session; the app says so (`CONFIRM_EMAIL_ON`) instead of hanging.
  - UI: one sheet in the gate (`src/hud/login.ts`) with Sign in / Create account toggle (`.login-modes`), Username, Password. Profile → Friends & followers uses the same calls when signed out. Everywhere the account shows (gate, Profile header) uses `accountLabel()` → `@username`, never the fake email. The "pick your handle" step pre-fills the username. The on-device PIN lock / Welcome back is unchanged.
  - Removed: magic link + 6-digit OTP (`sendMagicLink`, `verifyMagicCode`, `normalizeEmailOtp`), link-return parsing (`authReturn`, `authRedirectUrl`, `AUTH_SITE_URL`, `finishEmailLink`, `finishLinkSignIn` in `main.ts`), `.login-code` CSS. `detectSessionInUrl` is now off; `persistSession` + `autoRefreshToken` + the cookie-mirrored storage stay.
  - **Supabase switch (required):** Dashboard → project `slide` (`zmriqctjkhwmhuvxyhdd`) → Authentication → Sign In / Providers → Email → turn **Confirm email** OFF → Save. On 2026-10-06 the public `/auth/v1/settings` reported `mailer_autoconfirm: false` (Confirm email ON); no Supabase management token or CLI login on the box, so it wasn't changed from here. Until it's off, Create account shows the "server still asks for email confirmation" message; sign-in of username accounts can't happen because none can be created.
  - **Older email accounts:** they had no password, so they can't sign in any more. Those drivers make a new username account (new uid). Their old on-device garage/places stay in localStorage under the old uid's keys but aren't shown; their old public profile/follows sit on the old uid.
  - Tests: `src/lib/account.test.ts` (15: validation, mapping, label, sign-up/sign-in/taken/wrong password/confirm-email-on/restore/sign-out) and `src/lib/cloud.test.ts` (2). Screenshot at 390 px: `/workspace/slide-shots/username-signin.png` (box).

## Teammate slots (stable IDs — do not rename)

| Who | Slot | Selector | Where |
|---|---|---|---|
| Nard | Lane strip | `#lane-strip` / `[data-slot="lane-strip"]` | After `#maneuver`. Filled from Valhalla `lanes`; hidden when none. |
| Nard | Mute button | `#drive-mute` / `[data-slot="drive-mute"]` | Grim owns the button. Speech listens for `slide:voice-mute` and mirrors `slide.voice.v1`. |
| Nard | Drive report | `#drive-report` | Bottom-right in drive. Calls `radar.openReport()`. |
| Leon | XP / badges | `#arr-xp` / `[data-slot="arrival-xp"]` | Inside `#arrival`, under `.arr-stats`. Still empty/`hidden`. |
| Leon | Share card | `#share-card-mount` / `[data-slot="share-card"]` | Inside `#arrival`, above `.arr-actions`. Preview only. Listen for `slide:share-trip` → `shareTrip(lastAward().shareCard + ride)`. |
| Leon | Arrival share | `#arr-share` | Grim's Share on the trip card. One button; Leon does not add another. |
| Leon | 3D car stage | `#car-stage` / `[data-slot="car-stage"]` | HUD overlay; 2D garage preview stays `#g-preview`. Arrival 2D ride is `#arr-ride`. |
| Both | Place card | `#place-card` `#place-name` `#place-addr` `#place-save` `#place-go` | After a search pick, before routing. |
| Both | Route carousel | `#route-carousel` `#route-track` `#route-dots` | Review sheet. One card per real `SlideRoute`. |
| Both | Location sheet | `#loc-banner` `#loc-title` `#loc-msg` | `data-kind` = denied / unavailable / timeout / insecure. |

Unhide empty slots with `el.hidden = false`. Do not add a CSS override layer.

## Owner setup for accounts + radar

### Supabase (done by Claude on 2026-10-04; two functions left)

- **Project:** `slide` (its own project in T0PK1DK's Org, us-east-1). Ref `zmriqctjkhwmhuvxyhdd`.
- **URL:** `https://zmriqctjkhwmhuvxyhdd.supabase.co`
- **Anon key:** Dashboard → Project Settings → API Keys → `anon` (legacy JWT; supabase-js accepts it). It's public by design, and RLS protects the data. The publishable key `sb_publishable_…` also works.
- **Applied:** profiles, follows, reports, report_votes and presence, with RLS; `reports_near`, `submit_report`, `vote_report`, `my_social_counts`, `share_presence` and `friends_presence`; and the grants. These match `supabase/migrations/` except for the last two functions below.
- **Still to run (Nard):** the connector timed out on statements containing `delete`, so paste this into Dashboard → SQL Editor and click Run. Until it's run, "Stop sharing" and "Delete my Slide account" fail:

```sql
create function public.stop_presence()
returns void language sql security definer set search_path = '' as $$
  delete from public.presence where user_id = auth.uid();
$$;
create function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.stop_presence() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.stop_presence() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
```

- **Security advisor:** it flags the functions as `SECURITY DEFINER` and callable, which is **intended**: the app calls them over RPC, each one checks `auth.uid()` itself, and the tables with no policies are only reachable through them. No action is needed.

### Nard: the rest of setup

1. **Supabase Auth** (Dashboard → Authentication) — Nard must confirm these when deploying the persistent-accounts PR. **No new SQL migration.** The existing `supabase/migrations/` files already cover profiles, follows, reports and presence.
   - **URL Configuration → Site URL:** `https://kings-slide.pages.dev` (no trailing path). This is the only origin the live Home Screen app uses.
   - **Redirect URLs** (exact + wildcard; Save after each):
     - `https://kings-slide.pages.dev`
     - `https://kings-slide.pages.dev/**`
     - `https://*.kings-slide.pages.dev/**` (preview deploys)
   - **Auth providers:** Email enabled. Magic link / OTP on. "Confirm email" can stay on — the link is the confirmation.
   - **Email Templates → Magic Link:** the email must show the 6-digit OTP *and* the link. iPhone Home Screen apps have their own storage (cookies included), so tapping the link in Safari will not sign the installed app in. Drivers type `{{ .Token }}` inside Slide; `verifyOtp({ type: "email" })` creates the session there. If the template editor is locked, add custom SMTP first (Resend has a free tier), then paste:

     **Subject**
     ```
     Your Slide code is {{ .Token }}
     ```

     **Body** (replace the default HTML)
     ```html
     <h2>Sign in to Slide</h2>
     <p>Type this 6-digit code in the Slide app:</p>
     <p style="font-size:28px;letter-spacing:6px;font-weight:600">{{ .Token }}</p>
     <p>On iPhone, stay in the Home Screen app and type the code there. Tapping the link opens Safari and will not sign the installed app in.</p>
     <p>On a computer or in Safari you can tap this link instead:</p>
     <p><a href="{{ .ConfirmationURL }}">Open Slide</a></p>
     ```

   - **Email sending:** the built-in sender allows only a few emails per hour, which is fine for testing. For friends at scale (and to unlock the template editor if it is locked), add SMTP (e.g. Resend).
   - Do **not** switch this project to D1 or password-only auth. After the first code entry, supabase-js `persistSession` + `autoRefreshToken` keeps that *same* app signed in.
2. **Cloudflare Pages `kings-slide`** (account `f52402ec…`). It is a **Direct Upload** project (no Git connection), so Cloudflare never builds the app: `VITE_` values are baked in on the machine that runs `npm run build`, and dashboard env vars never reach the bundle. Server keys are Pages **secrets** read by the Functions at runtime.
   - `VITE_SUPABASE_URL` is in the committed `.env.production` (public value).
   - `VITE_SUPABASE_ANON_KEY` (public by design, `role: anon`) is in `.env.production` too (2026-10-04). The same two values are also stored as Pages secrets for the record, but the bundle only gets them from `.env.production`.
   - `TOMTOM_API_KEY` (secret, **already set** on kings-slide): free TomTom developer key. Turns on Fuzzy search, Routing traffic ETA + speedLimit sections, the flow layer, TomTom incident details, and live delay. Without it, search falls back to Photon/Nominatim/Census and FDOT / Miami-Dade / driver icons still show; the flow layer stays off. Free tier ≈ 2,500 non-tile + 50k tile requests/day.
   - `FL511_API_KEY` (secret, **optional** now that FDOT DIVAS + Miami-Dade Police feed `/api/incidents` without a key): a free key from fl511.com (Developers / API).
   - `TRANSIT_FEEDS` (secret): **set on 2026-10-04** for production and preview, with the three feeds that work without a key (see below).
   - Cameras need no key: they use the public Overpass API with OSM attribution.
   - Commands (Node ≥ 22, from the repo root, so `functions/` is bundled too):

     ```bash
     export CLOUDFLARE_ACCOUNT_ID=f52402ec949a9f17b451e9ec801a9c68
     # FL511 key → production secret (repeat with --env preview for preview deploys)
     printf %s "$TOMTOM_KEY" | npx wrangler pages secret put TOMTOM_API_KEY --project-name kings-slide
     printf %s "$FL511_KEY" | npx wrangler pages secret put FL511_API_KEY --project-name kings-slide
     # Build (reads .env.production) and deploy production
     npm run build && npx wrangler pages deploy dist --project-name kings-slide --branch main
     # Preview only (does not touch production): --branch <name> → https://<name>.kings-slide.pages.dev
     ```

   - **Transit feeds** (fetched and decoded with `src/lib/sources/gtfsrt.ts` on 2026-10-04, Sunday ~9:40 ET):

     | Agency | VehiclePositions URL | Key | Vehicles seen |
     | --- | --- | --- | --- |
     | Broward County Transit | `https://myride2.broward.org/gtfsrealtime/api/vehiclepositions` | none (the server returns 403 to curl's default User-Agent; Workers fetch is fine) | 105 (104 fresh) |
     | Tri-Rail (SFRTA) | `https://gtfsr.tri-rail.com/download.aspx?file=position_updates.pb` | none (`https` only; `http` times out) | 6 |
     | Brightline | `https://feed.gobrightline.com/position_updates.pb` | none (`https` only) | 8 (5 fresh) |
     | Miami-Dade Transit (Metrobus, Metrorail, Metromover) | `https://api.goswift.ly/real-time/miami/gtfs-rt-vehicle-positions` | **Swiftly API key**, header `Authorization`, request at https://www.goswift.ly/realtime-api-key | 401 without a key |

     Once King has the Swiftly key, add `{"agency":"Miami-Dade Transit","mode":"bus","url":"https://api.goswift.ly/real-time/miami/gtfs-rt-vehicle-positions","header":"Authorization","key":"…"}` to the list and run `pages secret put TRANSIT_FEEDS` again with the whole list (it replaces the old value). Not used: Broward's TrackTrolley feed (community shuttles, a key embedded in a third-party listing, mostly stale vehicles) and Brightline via Swiftly (same data as the keyless feed).
3. **Free-tier limits:**
   - Supabase free: 500 MB database, 50k monthly active users. The project **pauses after a week without use**; restore it from the dashboard.
   - Only 2 free projects can be active at once; King's others are paused.
   - FL511: one upstream call per minute is shared by all drivers.

## Traffic provider decision (owner to approve)

Traffic-aware times need a paid provider, and the owner's rule is "HERE/TomTom only if I approve paid APIs".

| Provider | Traffic ETA | Alternatives | Toll prices (SunPass) | Fits Slide? |
| --- | --- | --- | --- | --- |
| **HERE Routing v8** | Yes | Yes | Yes, returns toll costs | **Recommended**: works with our own map, and it's the only option here that also covers the toll-price requirement |
| TomTom Routing | Yes | Yes | No prices (avoid tolls only) | Good fallback if HERE is declined |
| Mapbox Directions (driving-traffic) | Yes | Up to 3 routes | No US prices | Check its terms on use with a non-Mapbox map before choosing |
| Google Routes API | Yes | Yes | Yes | **Rejected**: Google Maps Platform terms don't allow showing its results on a non-Google map, and HANDOFF forbids replacing OSM routing with Google |

- Both HERE and TomTom have a monthly free tier and charge per request above it. **Check current prices and free-tier limits on their pricing pages before approving.** This container can't reach them, so no numbers are written here that haven't been checked.
- **Key handling:** never a `VITE_` variable. Traffic and Routing live in `functions/api/traffic/[[path]].ts` and Search in `/api/geocode` + `/api/suggest`; all read the Pages secret `TOMTOM_API_KEY`. A future HERE route proxy would be a separate Function. Routing cache ~15 s; search ≤ 30 min.
- **Fallback:** keep the current free Valhalla path (not OSRM; Slide has never used OSRM) whenever the provider errors or the quota runs out. The UI must then say "no live traffic".
- Once approved: the provider adapter goes behind `src/lib/sources/routing/*` with the same `SlideRoute` output, and the Collins Ave check is "within ~10% of Google at the same time of day".

## Next for Nard (start here)

Updated 2026-09-25, after PR #13. Claude built everything in **What already works**. Claude can't reach Cloudflare or create the Supabase project, so everything from here needs someone with the owner's accounts. Work top-down, one PR per numbered block, and never push to `main` directly.

### 1. Turn on the data (with the owner, ~30 min, no code)

Follow **Owner setup for accounts + radar** above, step by step:
- [x] Supabase project `slide` created and the schema applied by Claude (2026-10-04).
- [x] Run the short SQL block in **Owner setup → Supabase** (stop sharing + delete account) — done 2026-10-04.
- [x] Supabase Auth Site URL `https://kings-slide.pages.dev` (2026-10-04). The Magic Link template can't be edited without custom SMTP, so the email has a link and no code; the app accepts the link (separate PR).
- [x] `VITE_SUPABASE_URL` in `.env.production`; `TRANSIT_FEEDS` secret set (production + preview) with Broward, Tri-Rail and Brightline (2026-10-04).
- [x] `VITE_SUPABASE_ANON_KEY` in `.env.production`; production redeployed with Functions (2026-10-04).
- [ ] `FL511_API_KEY` secret (King requests the key), then redeploy.
- [ ] FL511 key: request it free at fl511.com (Developers / API).
- [x] Transit: Broward, Tri-Rail and Brightline work without a key (table in Owner setup). Miami-Dade needs a Swiftly key (King signs up). Never hard-code a URL in the repo code.

### 2. Verify against the real services (small PR with any fixes)

- [x] `/api/incidents` returns real items from FDOT DIVAS + Miami-Dade Police without a key (2026-10-04). FL511 stays optional: if a key is added and its items are empty while fl511.com shows events, save one raw FL511 event and fix the field mapping in `src/lib/sources/fl511.ts` (`fromFl511`, `fl511Kind`). Add that raw event as a test fixture. This closes "Verify FL511 field names" in TASKS.md.
- [x] `/api/cameras?lat=25.77&lon=-80.19` answers from Overpass (2026-10-04: 0 cameras mapped in that tile; Overpass was down earlier that morning).
- [x] `/api/transit` returns vehicles for each feed (Broward, Tri-Rail, Brightline; 2026-10-04). An empty agency usually means a wrong URL or key header.
- [ ] Sign in on two phones and follow each other. Check the Friends tab, then share location and see the other phone's rough spot while planning, and not while driving.
- [ ] Drive with the radar and send a Report. Check that the other phone sees it and can vote "Not there".
- [ ] Plan Fort Lauderdale → 9601 Collins Ave. Check that there are 3 or more lines, a "Has tolls" flag, and the Slide pick within +10% of Fastest.
- [ ] Complete the **Definition of done** below on a real iPhone (Safari) and Android (Chrome), recorded as a screen video.

### 3. Stability (from TASKS.md P0)

- [x] Offline / no-route sheet (when Valhalla or Photon fail, or no route is found), with a "Try again" button (2026-10-04).
- [~] Map under 3 s on Slow 4G: HUD/login now paint before MapLibre (0.79 s), style pre-cached in `public/sw.js`. Repeat visits render the map in ≈2.6 s; a cold first visit is ≈5.0 s (was 6.0), limited by ≈800 kB of engine + sprite + tiles (see session log 2026-10-04).
- [ ] Split `src/main.ts` into `hud/ drive/ plan/ map/` with no behavior change. Do it as its own PR, after the verification above passes.

### 4. Features (owner's Phase 2–5, one PR each)

- [x] **Lane guidance** into Grim's `#lane-strip` (based on PR #35).
- [x] **Voice** listens to Grim's `#drive-mute` (`slide:voice-mute` / `html[data-voice]`) on #35.
- [ ] **Your usual:** learn the routes you repeat between the same places (on-device only), and tag that line "Your usual".
- [ ] **Real pace ghost:** record your own GPS run on a route and replay it next time (TASKS P2). This replaces the removed fake ghosts. Never draw invented drivers.
- [ ] Leave-by (`leaveByForTarget` exists), the upcoming speed-limit chip, and fitting the camera to the route on the first plan.
- [ ] Transit/walk/bike tab, home sheet, and worker features: see the owner prompt in the 2026-09-25 session log.

### Waiting on the owner — do not start

- **Toll prices:** they come with HERE, so they're also blocked on that decision. Live speeds / delay now use TomTom Flow Segment Data when the Pages secret `TOMTOM_API_KEY` is set.

### Hard rules

- Real data only. Never invent traffic, reports, drivers or police positions; police are always "reported by drivers".
- Never suggest exceeding the limit. Never scrape Google or Waze. No ads.
- Keys live in Pages secrets. Only the Supabase URL and anon key may be `VITE_` variables.
- Personal data (drives, places, car) stays on the phone.
- Before every PR, `npm run build` and `npm test` must pass. Update `TASKS.md`, this file's session log, and the Layout section if you add files.

### Definition of done for the owner's demo

Record a short screen video on a real phone at https://kings-slide.pages.dev showing each step:
1. The map loads in under ~3 s on 4G, with no blank screen.
2. The first visit shows "Set up your driver"; after that, a reload goes straight in.
3. Locate asks once, and the "you" dot sits on your real position.
4. Planning a real Miami trip shows 3 or more routes with Slide pick / Fastest / No tolls.
5. Go: the car and map follow you and the turn banner updates. The radar shows real items.
6. A wrong turn reroutes within ~10 s.
7. Arrival → End saves the trip into Your trips.
8. On a laptop, the Command view shows around the map.
9. Add to Home Screen opens full screen and stays signed in.
