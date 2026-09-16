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
src/lib/maphealth.ts   WebGL support probe
docs/PRODUCT.md        scoring contract
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

- Ghosts are **simulated on the current route**, not live other drivers.
- `shareGhost` is a flag only. No presence server.
- Car marker is an SVG wedge, not a 3D model.
- Snap-to-route is nearest-segment projection, not real map matching.
- 3D buildings depend on OpenFreeMap `building` layer; fail soft if missing.
- `main.ts` is one file. Split when adding nav guidance / GPS follow.
- Public Valhalla/Photon can rate-limit. Plan for self-host.
- Single tile/style host (OpenFreeMap). A driver now sees a clear "map didn't load" + Retry instead of a silent black canvas, and the rest of the app (search/plan/score/speedo) stays fully usable if the map never loads — but there is still no second provider, so a blocked/down host means no visual map for that driver, period.
- No GitHub Pages deploy yet.
- Turn-by-turn is the next-maneuver banner only; no full step list, no voice.
- No leave-by target, no live traffic.

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
- 2026-09-16 Claude: owner reported "I can't see the map." Investigated rather than guessed. Found two distinct real bugs: (1) `new maplibregl.Map()` throws *synchronously* on WebGL creation failure (confirmed empirically with `--disable-webgl` in headless Chromium — real, reproducible, not hypothetical), and since that line runs at top-level script scope, every line after it — every button's click handler, `wireGarage()`, `persist()` — never executed. A WebGL failure didn't just blank the map, it silently killed the *entire app's* interactivity with zero console output the average user would ever see. (2) No feedback at all if the tile/style host (`tiles.openfreemap.org`) is unreachable — network block, ad-blocker, corporate proxy. The existing `whenStyleReady()` queue already prevented a crash in that case, but nothing ever told the driver why the map stayed black forever. Given (2) is far more likely in the real world than (1) — WebGL is default-on in every mainstream browser; a blocked/rate-limited single tile host is not a rare failure mode for a public, keyless service — prioritized both but built the fix to cover whichever one hits.
  Fix: wrapped map construction in try/catch; a `mapAvailable` flag now gates all ~28 call sites across ~9 functions that touch `map` directly (Marker.addTo, camera, buildings, route layers), traced one by one rather than guessed. A 9s load-timeout watchdog catches the network-block case (map constructs fine, `load` just never fires); a `webglcontextlost` listener catches mid-session GPU loss. Either failure now shows one clear, centered panel ("Map didn't load" + a specific reason + Retry/Reload) instead of a silent black canvas — and critically, search/plan/score/speedo/garage all keep working underneath it. New `src/lib/maphealth.ts` (`hasWebGL()` probe, used only to phrase the message correctly, not to gate construction — the try/catch already catches the real failure reliably).
  Verified three ways in Chromium: WebGL genuinely disabled (full plan-to-drive flow completes, score renders, Locate/garage/camera-select all work, zero uncaught errors — previously all of this was dead); style host aborted (watchdog fires at ~9.6s with the right message, Retry recovers once the network is restored); normal path (zero regressions, fallback stays hidden throughout).
  **Left as hard tasks for Grok — see TASKS.md's new section.** These need real-network testing or an infra/product decision this sandboxed environment can't make blind: a verified second tile/style provider (retry alone doesn't help if the *only* host is down), the GitHub Pages/Cloudflare Pages deploy (still P0's last box), self-hosting Valhalla+tiles for Miami, and real map-matching to replace the nearest-segment GPS snap.
