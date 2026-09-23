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
docs/PRODUCT.md        scoring contract
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

- Ghosts are **simulated on the current route**, not live other drivers.
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

- 2026-09-23 Claude: Phase 0–1 docs only. Added `docs/STRATEGY.md`: day-1/day-30 framing, measurable Effort (weighted lefts, signals, merges, speed drops, lane changes), the proposed contract "Slide = least Effort within +10% of fastest" (lands in Phase 3 with a PRODUCT.md update), and a Borrowed / Rejected / Unique table. Found: `npm run build` fails on this branch (13 TS errors: `recents`/`home`/`work` missing from `GarageConfig`, 4-arg call at `main.ts:630`); `rankRoutes()` has no time bound, so a much slower route can win. No scoring-contract change yet.

## Claude follow-up

Do not pick these up in a Cursor drive-mode / overview PR. They are Claude’s next slice — see unchecked items under **Claude follow-up** in `TASKS.md`.

- Preferred / usual-route badge + stickiness
- Avoid filters (tolls/ferries) + Valhalla costing
- Leave later / depart-at (`leaveByForTarget` exists)
- Multi-stop / Add stop
- Transport mode switcher chrome
- Real traffic on the ribbon only when a source exists (never fake)
- Native CarPlay / iOS app — document only
