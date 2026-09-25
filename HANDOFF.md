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
- Geocode: `https://photon.komoot.io/api`
- Tiles: `https://tiles.openfreemap.org/styles/dark`

Units are **miles / mph**. First proving ground is **Miami**.

## What already works

Everything below is on `main` (PR #13, 2026-09-25): 0 TS errors, 54/54 unit tests, `npm run build` clean.

- **Search + plan:** Photon search, GPS locate, a "you" marker, and up to 5 stops (drag to reorder).
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
- **Accounts** (Supabase): email-code sign-in, @handle, followers / following / friends, driver search, and opt-in rough location for friends on the map.
- **Installable PWA** on Cloudflare Pages: https://kings-slide.pages.dev
- **Off until configured:** without the env vars, accounts, reports, FL511 and transit stay hidden and the rest of the app works.

## Layout

```
src/main.ts            HUD + map + plan + drive loop
src/styles.css         night glass HUD
src/lib/valhalla.ts    route / trace / search
src/lib/smooth.ts      Slide score + speed bands
src/lib/polyline.ts    precision-6 decode
src/lib/garage.ts      customization persist
src/lib/ghosts.ts      ghost replay along a line
src/lib/guidance.ts    next maneuver, posted-speed lookahead, turn arrows
src/lib/tracking.ts    live GPS watch + snap-to-route progress
src/lib/maplook.ts     night basemap lift, route ribbon, HUD fit padding
src/lib/profile.ts     on-device driver profile, session, PIN hash, persistent storage
src/hud/login.ts       login gate: set up driver / welcome back / lock
src/map/you.ts         "you are here" marker: glow dot, pulse, heading cone, accuracy halo
src/hud/command.ts     Command view: SEKAI-style dashboard (wide) / Insights sheet (phone)
src/lib/history.ts     on-device trip history + overview stats (live-GPS drives only)
src/plan/routeset.ts   merge route variants, bubble placement, toll labels (pure, tested)
src/plan/stops.ts      multi-stop helpers: reorder, stop reached, drop index (pure, tested)
src/plan/routes.test.ts  Vitest unit tests (`npm test`)
src/lib/alerts.ts      desktop alert list + switch suggestion from real data only (pure, tested)
src/lib/dashboard.test.ts  tests for alerts / week tiles
src/hud/profile.ts     Profile sheet: driver, My car, all-time stats, places, privacy; friends section (not live)
src/lib/cloud.ts       optional Supabase client (lazy; off when VITE_SUPABASE_* unset)
src/lib/social.ts      email-code sign-in, profiles, follow/unfollow, friends, search
src/lib/reports.ts     radar items, heading-up geometry, alerts, report/vote RPCs
src/lib/sources/fl511.ts  FL511 event → radar item (pure, tested)
src/hud/radar.ts       mini radar, Report sheet, heads-up banner, Nearby list
src/hud/social.ts      Profile → Friends & followers (sign in, handle, lists, search)
functions/api/incidents.ts  Pages Function: FL511 proxy (key in FL511_API_KEY secret)
functions/api/cameras.ts    Pages Function: OSM enforcement cameras via Overpass (24 h tile cache)
functions/api/transit.ts    Pages Function: GTFS-realtime buses/trains from TRANSIT_FEEDS secret
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
docs/STRATEGY.md       why Slide wins, Effort metric, design recon (Borrowed / Rejected / Unique)
HANDOFF.md             this file
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
- Turn-by-turn is the next-maneuver banner only; no full step list, no voice.
- No leave-by target. No live traffic: that waits on the traffic provider decision.
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

## Owner setup for accounts + radar

1. **Supabase project:** create a free project named `slide` (region us-east-1). Claude's permissions couldn't create it. Then apply **both** files in `supabase/migrations/`, in name order (have Claude do it, or paste each into the SQL editor).
2. **Supabase Auth settings:**
   - **URL Configuration:** Site URL `https://kings-slide.pages.dev`.
   - **Email Templates → Magic Link:** add `{{ .Token }}` so the email shows the 6-digit code the app asks for.
   - **Email sending:** the built-in sender allows only a few emails per hour, which is fine for testing. For friends at scale, add SMTP (e.g. Resend, which has a free tier).
3. **Cloudflare Pages → kings-slide → Settings → Environment variables** (Production), then redeploy:
   - `VITE_SUPABASE_URL` = the project URL
   - `VITE_SUPABASE_ANON_KEY` = the publishable (anon) key. It's public by design; RLS protects the data.
   - `FL511_API_KEY` = your key from fl511.com's developer page. Add it as a **secret**.
   - `TRANSIT_FEEDS` (**secret**) = a JSON list of GTFS-realtime VehiclePositions feeds. Get each URL and key from the agency's developer page (Miami-Dade Transit, Broward County Transit, Tri-Rail/SFRTA, Brightline if published), e.g. `[{"agency":"Miami-Dade Transit","mode":"bus","url":"https://…","header":"x-api-key","key":"…"},{"agency":"Tri-Rail","mode":"rail","url":"https://…"}]`
   - Cameras need no key: they use the public Overpass API with OSM attribution.
4. **Free-tier limits:**
   - Supabase free: 500 MB database, 50k monthly active users. The project pauses after a week without use.
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
- **Key handling:** never a `VITE_` variable, because anything given to the browser ends up in the public bundle. Add a Cloudflare Pages Function (`functions/api/route.ts`) that holds the key as a Pages secret and forwards the request. Cache identical requests for ~60 s to stay inside the free tier.
- **Fallback:** keep the current free Valhalla path (not OSRM; Slide has never used OSRM) whenever the provider errors or the quota runs out. The UI must then say "no live traffic".
- Once approved: the provider adapter goes behind `src/lib/sources/routing/*` with the same `SlideRoute` output, and the Collins Ave check is "within ~10% of Google at the same time of day".

## Next for Nard (start here)

Updated 2026-09-25, after PR #13. Claude built everything in **What already works**. Claude can't reach Cloudflare or create the Supabase project, so everything from here needs someone with the owner's accounts. Work top-down, one PR per numbered block, and never push to `main` directly.

### 1. Turn on the data (with the owner, ~30 min, no code)

Follow **Owner setup for accounts + radar** above, step by step:
- [ ] Create the Supabase project `slide`, then run both files in `supabase/migrations/` in name order in the SQL editor.
- [ ] Supabase Auth: set the Site URL to `https://kings-slide.pages.dev`, and add `{{ .Token }}` to the Magic Link email template.
- [ ] Cloudflare Pages `kings-slide` → Production env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `FL511_API_KEY` (secret), `TRANSIT_FEEDS` (secret, JSON list). Then **redeploy `main`**, because `VITE_` values are baked in at build time.
- [ ] FL511 key: request it free at fl511.com (Developers / API).
- [ ] Transit: find the GTFS-realtime **VehiclePositions** URL (and key, if any) for Miami-Dade Transit, Broward County Transit, Tri-Rail, and Brightline if it publishes one. Leave out any agency that has no feed. Never hard-code a URL in the repo.

### 2. Verify against the real services (small PR with any fixes)

- [ ] `https://kings-slide.pages.dev/api/incidents?lat=25.77&lon=-80.19` returns items. If it returns `[]` while fl511.com shows events, save one raw FL511 event and fix the field mapping in `src/lib/sources/fl511.ts` (`fromFl511`, `fl511Kind`). Add that raw event as a test fixture. This closes "Verify FL511 field names" in TASKS.md.
- [ ] `/api/cameras?lat=25.77&lon=-80.19` returns cameras (Overpass; may be slow the first time, then cached).
- [ ] `/api/transit?lat=25.77&lon=-80.19` returns vehicles for each feed. An empty agency usually means a wrong URL or key header.
- [ ] Sign in on two phones and follow each other. Check the Friends tab, then share location and see the other phone's rough spot while planning, and not while driving.
- [ ] Drive with the radar and send a Report. Check that the other phone sees it and can vote "Not there".
- [ ] Plan Fort Lauderdale → 9601 Collins Ave. Check that there are 3 or more lines, a "Has tolls" flag, and the Slide pick within +10% of Fastest.
- [ ] Complete the **Definition of done** below on a real iPhone (Safari) and Android (Chrome), recorded as a screen video.

### 3. Stability (from TASKS.md P0)

- [ ] Offline / no-route sheet (when Valhalla or Photon fail, or no route is found), with a "Try again" button.
- [ ] Map under 3 s on Slow 4G (today ≈5.8 s): show the HUD and login before MapLibre loads, and pre-cache the style in `public/sw.js`.
- [ ] Split `src/main.ts` into `hud/ drive/ plan/ map/` with no behavior change. Do it as its own PR, after the verification above passes.

### 4. Features (owner's Phase 2–5, one PR each)

- [ ] **Your usual:** learn the routes you repeat between the same places (on-device only), and tag that line "Your usual".
- [ ] **Real pace ghost:** record your own GPS run on a route and replay it next time (TASKS P2). This replaces the removed fake ghosts. Never draw invented drivers.
- [ ] Leave-by (`leaveByForTarget` exists), the upcoming speed-limit chip, and fitting the camera to the route on the first plan.
- [ ] Transit/walk/bike tab, home sheet, and worker features: see the owner prompt in the 2026-09-25 session log.

### Waiting on the owner — do not start

- **Traffic-aware ETAs** (Slide said 31 min where Google said 42): needs a paid provider. See **Traffic provider decision**; HERE is recommended. FL511 can't do this. Until it's approved, the ETA note stays "Typical time · no live traffic yet".
- **Toll prices:** they come with HERE, so they're also blocked on that decision.

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
