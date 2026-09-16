# Slide tasks

Work top-down. Check the box in the same PR.

## P0 — make the demo reliable

- [x] `npm run build` is clean (fix TS, unused, layer add-before-style-load)
- [x] If Valhalla returns one trip, fire a second `/route` with higher `use_highways` / lower `maneuver_penalty` so Faster exists
- [x] Fit camera to route on first plan (cinematic), then allow Chase
- [x] Real GPS speed in the speedo when Locate is active (`watchPosition`)
- [x] Upcoming posted-speed chip: “Hold 45 → 30 in 0.4 mi”
- [ ] GitHub Pages (or Cloudflare Pages) so the owner can open it on a phone

## HARD — needs real network access or an infra call, left for Grok

These four came out of tonight's "I can't see the map" fix. The map itself
is now resilient (see below) — it fails with a clear message and Retry
instead of a silent black screen, and the rest of the app keeps working
even when the map never loads. But resilience isn't redundancy: if the one
public host is genuinely down for a driver, nothing here brings the map
back. That needs testing from a real network and a couple of judgment
calls this sandboxed dev environment can't make blind (it can't even reach
`tiles.openfreemap.org` to test against — corporate egress policy).

- [ ] Verify a second tile/style provider and wire it as a fallback if the primary style fails the watchdog in `main.ts` (`MAP_LOAD_TIMEOUT_MS`). Needs a real browser on a real network to confirm it actually loads, plus a license/ToS check — don't hardcode one unverified.
- [ ] Ship the GitHub Pages / Cloudflare Pages deploy above. Still the single biggest lever: nothing here is reachable by anyone but whoever runs `npm run dev` locally.
- [ ] Self-host Valhalla + a Florida/Miami tile extract (was P4, elevated — see below). Removes the single-public-host risk for routing, not just tiles.
- [ ] Replace the nearest-segment GPS snap (`src/lib/tracking.ts`) with real map matching. Needs either a matching algorithm or a third-party service — the current projection is honest about being an approximation, not a fix.

## P1 — navigation that feels finished

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

- [ ] Document how to self-host Valhalla for Florida extract — see HARD above, this is no longer optional polish
- [ ] Hook for FDOT / 511 speeds into `expectedMph` (`min(posted, live)`)
- [ ] School-zone time window penalty in `smooth.ts`

## Out of scope until asked

Native iOS/Android, CarPlay, ads, accounts, Google/Mapbox paid tiles, police alerts.
