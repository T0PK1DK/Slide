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
- 3D buildings depend on OpenFreeMap `building` layer; fail soft if missing.
- Valhalla `alternatives: true` can return 1 route. Need a second costing pass if so.
- Speedo uses trip average mph, not live GPS speed.
- `main.ts` is one file. Split when adding nav guidance / GPS follow.
- Public Valhalla/Photon can rate-limit. Plan for self-host.
- No GitHub Pages deploy yet.
- No turn-by-turn voice, no leave-by target, no live traffic.

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
