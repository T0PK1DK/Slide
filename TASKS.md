# Slide tasks

Work top-down. Check the box in the same PR.

## Strategy

> Handed to Nard on 2026-09-23. Full phase checklist: **Next for Nard** in `HANDOFF.md`.

- [x] Phase 0–1: `docs/STRATEGY.md` (Magi pass + design recon)
- [ ] Phase 4/5: 3D living map — garage car on Explore, "Miami driven %" (on-device), Effort icons on the route
- [ ] Presence design (friends' cars, opt-in) before any backend
- [ ] Phase 3: `rankRoutes()` = least Effort within +10% of fastest (today it has no time bound)

## Phase 1 — Better routes (owner prompt, 2026-09-25)

- [ ] **Traffic-aware ETAs** — blocked on the owner approving a provider (HANDOFF → Traffic provider decision; HERE recommended)
- [x] 3+ routes drawn together (Slide / Fastest / No-tolls costings + `alternates`), tap line or bubble to select
- [x] Tags: Slide pick, Fastest, No tolls (Your usual comes with Phase 2 learning)
- [x] Tolls flagged per route from Valhalla `has_toll`; "Has tolls" with no price until a price source exists
- [x] Route options sheet: avoid tolls / highways / ferries (saved)
- [x] Add stops (up to 5), drag to reorder, dropped as reached
- [ ] Verify on the live site: real Valhalla returns `alternates` and `has_toll` for Fort Lauderdale → 9601 Collins Ave

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
- [ ] Map under 3 s on Slow 4G (today ≈5.8 s; ≈3.0 s on good 4G): load HUD/login before MapLibre, pre-cache style
- [ ] Faster alternative rarely exists on public Valhalla (same trip from both costings) — needs self-host or a real alternate strategy
- [ ] Offline / no-route sheet + one fetch retry

- [x] `npm run build` is clean (fix TS, unused, layer add-before-style-load)
- [x] If Valhalla returns one trip, fire a second `/route` with higher `use_highways` / lower `maneuver_penalty` so Faster exists (preview)
- [ ] Fit camera to route on first plan (cinematic), then allow Chase
- [x] Real GPS speed in the speedo when Locate is active (`watchPosition`)
- [ ] Upcoming posted-speed chip: “Hold 45 → 30 in 0.4 mi”
- [x] GitHub Pages (or Cloudflare Pages) so the owner can open it on a phone

## P1 — navigation that feels finished

- [x] Turn-by-turn next instruction banner from Valhalla maneuvers (preview GO mode)
- [ ] Snap player marker to shape from live GPS (map matching later)
- [ ] Leave-by: user sets arrival clock → show depart time + 3 min buffer (`leaveByForTarget` already exists)
- [ ] Door-level destination note in UI (entrance / garage) even if pin is still centroid
- [ ] Offline message when Photon/Valhalla fail

## P2 — ghosts that can become real

- [x] Record local ghost of last GO in localStorage and replay as YOU
- [ ] Replay *your* last ghost against the new run
- [ ] Sketch `src/lib/presence.ts` with `GhostSample` wire format (`tag`, `color`, `lon`, `lat`, `bearing`, `t`, `routeHash`)
- [ ] Do not build a full multiplayer backend until P0 is done

## P3 — cars and camera

- [ ] Better car glyph (side profile + lights). Optional later: MapLibre custom layer / Three
- [ ] Trail particles or denser dashed ghost trails
- [ ] Building extrusion fallback if `source-layer: building` missing (hide toggle, don’t crash)

## P4 — Miami-quality data

- [ ] Document how to self-host Valhalla for Florida extract
- [ ] Hook for FDOT / 511 speeds into `expectedMph` (`min(posted, live)`)
- [ ] School-zone time window penalty in `smooth.ts`

## Out of scope until asked

Native iOS/Android, CarPlay, ads, server accounts (on-device login exists), Google/Mapbox paid tiles, police alerts.
