# Slide

Driver-first navigation that prefers the **smoothest** line — not the route that shaves 40 seconds by cutting through a neighborhood.

Slide scores every candidate on turn density, signal load, road class stability, posted-speed coverage, and speed variance. Then it shows **posted mph**, **expected mph**, and **time on each segment** so the ETA is something you can trust.

Live stack: OpenStreetMap + Valhalla + MapLibre. No account. No ads.

## What v0.1 does

- Search start and end (Photon / OSM)
- Use current GPS location
- Request a primary route plus alternatives
- Re-score them with a **Slide score** (higher = smoother, more predictable)
- Color the chosen line on a dark driving map
- Break the trip into speed bands: road name, posted limit, expected speed, distance, time
- Show arrival clock from real segment speeds

Default bias is Miami because that is the first proving ground. It routes anywhere Valhalla has coverage.

## Smoothness, not just fastest

| Signal | How Slide uses it |
| --- | --- |
| Maneuver count | Extra turns lower the score |
| Traffic signals | Dense signal grids are penalized |
| Road class | Motorway / primary preferred over residential cut-throughs |
| Speed variance | A 25→65→25 stutter is less “slide” than a steady 45 |
| Posted-speed coverage | Better posted data → tighter timing |

The **Slide** option is the highest score. **Faster** is shown when a quicker path exists so you can take the tradeoff on purpose.

## Precise timing

Timing is not a single blob of “28 min.”

1. Valhalla gives edge speeds (limit, free-flow, or classified default).
2. `trace_attributes` attaches those speeds to the chosen shape.
3. Adjacent edges with the same name + posted + expected speed collapse into a **band**.
4. Band time = distance / expected speed.
5. Trip ETA is the sum. Arrival time is local clock + that sum.

This is still open-data timing — live probe traffic is the next layer, not a fake “perfect” number. The UI already leaves room for live speeds and a leave-by clock.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. Allow location or type two addresses.

```bash
npm run build
npm run preview
```

## Architecture

```
src/
  main.ts              HUD + map + planning loop
  lib/valhalla.ts      /route + /trace_attributes + Photon search
  lib/smooth.ts        Slide score, speed bands, clocks
  lib/polyline.ts      precision-6 polyline decode
  styles.css           night HUD
```

Public services used in development:

- Routing: `https://valhalla1.openstreetmap.de`
- Geocoding: `https://photon.komoot.io`
- Basemap: OpenFreeMap / MapLibre

Swap those endpoints in `src/lib/valhalla.ts` when you self-host.

## Roadmap

- [x] Smooth vs faster ranking
- [x] Posted + expected speeds per segment
- [x] Arrival time from band math
- [ ] Leave-by for a target arrival, with confidence
- [ ] Live traffic overlay (FDOT / 511 + probe speeds)
- [ ] Door-level destination (entrance, garage ramp)
- [ ] Vehicle profiles (car, EV range, height)
- [ ] On-device “roads I actually take”
- [ ] CarPlay / Android Auto HUD
- [ ] Self-hosted Valhalla for Miami-Dade + Broward

## Name

Slide is the feeling of a route that never makes you stab the brakes for a surprise turn. Fast is optional. Smooth is the product.

## License

MIT. Map data © OpenStreetMap contributors.
