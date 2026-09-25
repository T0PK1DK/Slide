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

Vite + TypeScript. No env file required. Public OSM services only.

- Routing: `https://valhalla1.openstreetmap.de`
- Geocode: `https://photon.komoot.io/api`
- Tiles: `https://tiles.openfreemap.org/styles/dark`

Units are **miles / mph**. First proving ground is **Miami**.

## What already works

- Search From / To (Photon), GPS locate
- Valhalla `/route` + alternatives, custom smooth costing
- `/trace_attributes` → posted speed, expected speed, road class, signals
- Slide score ranks routes (not raw fastest)
- Labels: **Slide** (smoothest) vs **Faster** vs **Alt**
- Speed rail + arrival clock
- Pitched MapLibre map, extruded buildings when the style exposes `building`
- Glowing route ribbon, player car marker, chase / cinematic / top cameras
- Garage in localStorage (`slide.garage.v1`): tag, body, glow, trail, camera, ghosts, buildings, share
- Seeded ghost cars on the chosen line + ghost delta HUD

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
3. No ads. No police-spotting social feed.
4. Privacy: garage + history stay on device until a real backend exists.
5. Ghosts are presence, not a race to cut neighborhoods.
6. Keep the night HUD. Do not flatten into a Google Maps clone.

## Known gaps (honest)

- Ghosts: the fake seeded drivers were **removed** (2026-09-25). No ghosts are drawn until a real source exists (your recorded pace run, or opt-in friends).
- `shareGhost` is a flag only. No presence server.
- Car marker is an SVG wedge, not a 3D model.
- Snap-to-route is nearest-segment projection, not real map matching.
- 3D buildings depend on OpenFreeMap `building` layer; fail soft if missing.
- `main.ts` is one file. Split when adding nav guidance / GPS follow.
- Public Valhalla/Photon can rate-limit. Plan for self-host.
- Phone demo is live on Cloudflare Pages: https://kings-slide.pages.dev (project `kings-slide`). Do not use slide.pages.dev — that hostname is an unrelated site.
- Turn-by-turn is the next-maneuver banner only; no full step list, no voice.
- No leave-by target, no live traffic.
- Native CarPlay requires an iOS app + Apple entitlement — Drive Mode is the phone-mounted stand-in.
- Plan now lands on a **route overview** sheet (duration / via / Go now). Drive starts only after Go. Leave later, Avoid, preferred-route, and multi-stop are Claude’s follow-up.

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

Claude did Phases 0–1 (PR #8, merged) and the app work after it: VIA skin, login, night-network look, "you" marker, Command view (**the follow-up PR on `claude/slide-app-completion-e4sn59` — merge it first**; PR #8 was merged before those commits landed). Read `docs/STRATEGY.md` first; it defines the core idea
and the Effort metric the later phases build on. Then work through the phases in order, one PR per phase.

**Definition of done for the owner's demo** (what "working live site" means — record a short screen video on a real phone at https://kings-slide.pages.dev showing each):
1. The page loads to a map in under ~3 s on 4G — no blank or black screen.
2. First visit shows "Set up your driver"; after setup, a reload goes straight in.
3. Tapping locate asks for location once, then the glowing "you" dot sits on your real position.
4. Searching a real Miami place and planning shows the glowing white route with Slide / Faster time cards.
5. Go → the car follows your real movement, the map follows you, the next-turn banner updates.
6. Taking a wrong turn reroutes within ~10 s.
7. Arriving shows the Arrival screen; End saves the trip into Drive insights / Your trips.
8. On a laptop, the Command view dashboard shows around the map.
9. Add to Home Screen opens full screen and stays signed in.

**Phase 2: loading + stability (do first)**
- [x] **Make the app start.** Right now the browser throws `The requested module '/src/lib/valhalla.ts' does not provide an export named 'sameTrip'` and nothing renders. Restore `sameTrip` / `tripShape` in `valhalla.ts` (they were used by the dual-route code in commit `4c12d77`), then fix the rest of the 17 TS errors. Run `npm run dev` and confirm the map + login appear before anything else.
- [x] **Fix navigation so it uses real location** (owner: "it's not working, I can't see myself"):
  1. **Start from GPS.** `ensureOrigin()` falls back to "Map center". When location is available, the From field should default to Current location, and planning should wait for the first fix (with a timeout) instead of using the map center.
  2. **Go = real GPS.** `startDrive()` must start `locateMe()` / `startTracking` if it isn't running. The simulated `chaseT` car in `tick()` should run **only** from an explicit "Preview drive" button, labelled as a preview, never as a silent fallback.
  3. **Camera follows the driver** in every camera mode while driving (today only `chase` follows; the default `cinematic` doesn't). Pause follow on user pan, and show a "Recenter" pill to resume.
  4. **Reroute when off-route.** `setOffRoute(snap.offRouteM > 60)` only shows a banner. After ~8 s continuously off-route (and moving), re-plan from the current fix to the same destination with the same ranking, and keep the Slide contract.
  5. **Arrival.** When within ~40 m of the destination (or progress ≥ 99%), stop tracking-driven guidance and show the Arrival screen (DESIGN.md 07).
  6. **Permission states.** Denied / unavailable / timeout each get a clear message plus "Search a start point instead". iOS needs HTTPS (pages.dev is fine; a LAN IP over http is not).
  7. The "you" dot (`src/map/you.ts`) and the drive car must never both show; `setHudMode` already hides the dot in Drive.
- [x] **Command view** (`src/hud/command.ts`) is built. After the app starts, check on a laptop (≥1100px wide): the three-column layout, the map column resizing correctly (`map.resize()`), and the existing plan search card not colliding with the Map/3D switch. On a phone, check menu → Drive insights opens the sheet and × closes it. Drive a real route with location on and End it: a trip appears in "Your trips".
- [x] Login is built (`src/hud/login.ts`). After the app starts, check: first visit shows "Set up your driver", the car tag seeds the garage tag, reload stays signed in, menu → Lock Slide shows "Welcome back", PIN works.
- [x] VIA skin patch applied on this branch (commit `VIA skin: premium night HUD…`). `docs/DESIGN.md` is the style contract and now has a **screen-by-screen build spec** for all 10 canvas screens — build from that, not from the canvas directly.
- [ ] VIA design canvas (reference only): https://claude.ai/artifact/3nbD5TfjZeoWbQEyf5yXu2. Where the canvas and `docs/DESIGN.md` disagree (traffic bars, crowd hazard reports, "Report a hazard", weather, "VIA" wordmark), **DESIGN.md wins**.
- [x] Fix the 17 TS errors so `npm run build` passes. `GarageConfig` is missing `recents` / `home` / `work` (used at `main.ts:334–395`), and there's a 4-arg call at `main.ts:630`. Add those fields to `garage.ts` with defaults and merge old `slide.garage.v1` data safely.
- [x] (emulated, see 2026-09-24 log — real phone still to do) Measure the live site on a phone over 4G *before* changing anything, and record the numbers in the session log. Check for a blank/black map, the style-load race, Valhalla/Photon timeouts, OpenFreeMap tile failures, fonts, and bundle size.
- [ ] (partly: boot skeleton, `font-display: swap` non-blocking, MapLibre chunk split, fetch timeouts exist; retry, offline/no-route sheet, `main.ts` split and lazy ghosts/3D still open) Fixes: a skeleton HUD that shows instantly, map fade-in when the style is ready, fetch timeout + one retry, offline and no-route states, `font-display: swap`, lazy-load ghosts and 3D, split `main.ts` into `hud/ drive/ plan/ map/`, and in-memory route/style cache. Target: a usable HUD in under 2 s.
- [x] Deploy to Cloudflare Pages (`kings-slide`) and verify on https://kings-slide.pages.dev.

**Phase 3: routing brain.** Slide route = least Effort within +10% of fastest (the window is configurable; the proposed clamp is 1–6 min). Today `rankRoutes()` in `src/lib/smooth.ts` has no time bound, so a much slower route can win. Put ranking in one pure, tested module that returns an event list per route. Put every data source behind `src/lib/sources/*`. Update `docs/PRODUCT.md`. Use legal/open data only; never scrape Google or Waze.

**Phase 4: UI clarity.** VIA look: Explore, search, place, route overview, drive, arrival, garage. Build each screen from the **Screen build spec** in `docs/DESIGN.md`. Add a trip timeline, onboarding, and offline/no-route states. It must be glanceable in 1.5 s with 4.5:1 contrast, 44 px touch targets and one accent color. Use Snap's street-level map as the reference for the night basemap (see STRATEGY).

**Phase 5: 3D HUD + ghosts.** Chase cam, lane ribbon, 3D car models, glowing ghost cars, and your own pace ghost. Hold 60 fps with a quality toggle. The surprise feature is **Miami driven %**: roads you've driven glow, stored on-device only. Also draw the garage car on Explore and the Pain points heat.

**Phase 6: TapN stub.** Add `src/lib/sources/tapn.ts` as a typed interface, with mock data behind a flag that's off by default.

**Waiting on the owner:** whether friends' cars on the map are a real goal (if so, write a presence/privacy design before any backend), and approval of the 1–6 min clamp.

## Claude follow-up

Do not pick these up in a Cursor drive-mode / overview PR. They are Claude’s next slice — see unchecked items under **Claude follow-up** in `TASKS.md`.

- Preferred / usual-route badge + stickiness
- Avoid filters (tolls/ferries) + Valhalla costing
- Leave later / depart-at (`leaveByForTarget` exists)
- Multi-stop / Add stop
- Transport mode switcher chrome
- Real traffic on the ribbon only when a source exists (never fake)
- Native CarPlay / iOS app — document only
