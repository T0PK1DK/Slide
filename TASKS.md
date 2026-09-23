# Slide tasks

Work top-down. Check the box in the same PR.

## Strategy

> Handed to Nard on 2026-09-23. Full phase checklist: **Next for Nard** in `HANDOFF.md`.

- [x] Phase 0–1: `docs/STRATEGY.md` (Magi pass + design recon)
- [ ] Phase 4/5: 3D living map — garage car on Explore, "Miami driven %" (on-device), Effort icons on the route
- [ ] Presence design (friends' cars, opt-in) before any backend
- [ ] Phase 3: `rankRoutes()` = least Effort within +10% of fastest (today it has no time bound)

## P0 — make the demo reliable

- [ ] `npm run build` is clean (fix TS, unused, layer add-before-style-load)
- [x] If Valhalla returns one trip, fire a second `/route` with higher `use_highways` / lower `maneuver_penalty` so Faster exists (preview)
- [ ] Fit camera to route on first plan (cinematic), then allow Chase
- [ ] Real GPS speed in the speedo when Locate is active (`watchPosition`)
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

Native iOS/Android, CarPlay, ads, accounts, Google/Mapbox paid tiles, police alerts.
