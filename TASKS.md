# Slide tasks

Work top-down. Check the box in the same PR.

## P0 — make the demo reliable

- [x] `npm run build` is clean (fix TS, unused, layer add-before-style-load)
- [x] If Valhalla returns one trip, fire a second `/route` with higher `use_highways` / lower `maneuver_penalty` so Faster exists
- [x] Fit camera to route on first plan (cinematic), then allow Chase
- [x] Real GPS speed in the speedo when Locate is active (`watchPosition`)
- [x] Upcoming posted-speed chip: “Hold 45 → 30 in 0.4 mi”
- [x] Phone Drive Mode: readable night map + route ribbon, CarPlay-simple HUD, first-run coach (native CarPlay is a later iOS app)
- [ ] GitHub Pages (or Cloudflare Pages) so the owner can open it on a phone

## P1 — navigation that feels finished

- [x] Route overview bottom sheet after plan: big duration + distance + via + **Go now** (Drive waits for the tap)
- [ ] Turn-by-turn list from Valhalla maneuvers, next instruction large
- [x] Snap player marker to shape from live GPS (map matching later)
- [ ] Leave-by: user sets arrival clock → show depart time + 3 min buffer (`leaveByForTarget` already exists)
- [ ] Door-level destination note in UI (entrance / garage) even if pin is still centroid
- [ ] Offline message when Photon/Valhalla fail

## P2 — ghosts that can become real

- [ ] Record local ghost of the last completed plan (samples + tag + color) in localStorage
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

## Claude follow-up (do not steal this slice)

Cursor shipped the post-plan **route overview sheet + Go now**. Leave these for Claude.

- [ ] Preferred / usual-route badge + preferred-route stickiness UX (Maps-style)
- [ ] Avoid filters sheet (tolls / ferries / etc.) — UI + Valhalla costing hooks
- [ ] Leave later / depart-at time picker (hook: `leaveByForTarget` already exists; overlaps the P1 leave-by item)
- [ ] Multi-stop / Add stop
- [ ] Transport mode switcher chrome (car-only can stay selected; UI scaffold only if cheap — full modes later)
- [ ] Finer traffic-on-ribbon if/when a traffic source exists (do not fake live traffic colors)
- [ ] Native CarPlay / iOS app track (document only — web cannot do native CarPlay; Drive Mode stays the phone stand-in)

## Out of scope until asked

Native iOS/Android, CarPlay, ads, accounts, Google/Mapbox paid tiles, police alerts.
