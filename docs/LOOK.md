# Slide look — store pins, place cards, hologram, ghost cars

Look HUD for King’s wishlist. **Nard owns the data** (`/api/stores`, `/api/places`, live ghosts). **Leon owns 3D models**. The real app (`index.html`) paints pins and the place sheet from those endpoints. Fixtures stay on **`/look.html`** and in tests.

Demo: **`/look.html`** (`?look=day`, `?place=osm:node/123`, `?empty=1`, `?loading=1`, `?skel=1`, `?motion=enter|reveal|drop|select`). Phone-first. Night is default; Day is a warm light preview.

## Live HUD (real app)

`mountLookLive` in `src/look/live.ts` (wired from `src/main.ts`):

| Piece | Source | Behaviour |
|---|---|---|
| Store pins | `GET /api/stores?tiles=` | Debounced 600 ms on map move. Skip below zoom 12. Client tile cache 8 min. Skeleton pins while the first Overpass call is in flight. Never blocks the map. |
| Place card | `GET /api/places` | Sheet opens on pin tap (and at a destination within 90 m). Store fields paint immediately; photos/copy shimmer until Wikidata returns. Client place cache 30 min. |
| Hologram | Leon `registerSlideModels()` | Slot above the selected pin and at the top of the card. |
| Ghost cars | `watchLiveGhosts` | Only when `cloudConfigured()` (Supabase). Off otherwise — no fixture ghosts in the real app. Hidden in Drive. Garage **Ghosts** still toggles them. Rough ~1 km friend presence is unchanged. |

Errors and empty views are a soft pill (`Stores didn’t load · tap to retry`, `No stores in view`, `Zoom in for stores`). A failed tile is not cached, so retry hits the network. Hidden entirely in Drive / Arrive.

Local `npm run dev` / `preview` serve `/api/stores` and `/api/places` through the Vite plugin (same `loadStoresForRequest` / `loadPlaceInfo` as the Pages Functions). The Functions files themselves are not rewritten.

## What you get

| Piece | Files | Behavior |
|---|---|---|
| Store pins | `src/map/store-pins.ts`, `src/look/marks.ts`, `src/look/motion.ts` | Teardrop brand pin + original two-letter monogram. Pins drop in when a tile lands; the selected one scales up with a pulsing halo. Unknown chains use the category glyph. Clusters get a glow disc when zoomed out (`clusterRadius` 52, `clusterMaxZoom` 14). Tap a cluster to zoom in; the nearest leaf keeps the label (`focusId`) without opening the card. Labels from zoom 15 — no overlap; selected / focused then nearest-to-center win, stacked neighbors fade. |
| Place card | `src/hud/place-card.ts` | Bottom sheet slides up and expands. Hologram stage, name, badge, open-now chip, formatted hours, address, icon actions, photo strip, description. Empty-states every missing field. |
| Hologram | `src/look/hologram.ts` | Slot above the selected pin **and** in `.look-holo-well` on the card. Reveal animation is CSS on the stage. Leon fills `registerHologramRenderer` (unchanged). Honors `prefers-reduced-motion`. |
| Ghost cars | `src/map/ghost-car.ts` | Color, name tag, heading arrow. Visual only. 3D via `mountGhostCar`. |

Logos are **bundled monograms**, not hotlinked brand files or paid image APIs. Demo photos on `/look.html` are original SVG stills (`src/look/photos.ts`). Live cards credit Wikimedia when Wikidata has an image.

## Fixtures vs live

```ts
import { mountLookLive } from "./look/live";

const look = mountLookLive({
  map,
  host: document.querySelector(".hud")!,
  getMode: () => hudMode,
  dest: () => dest,
  showGhosts: () => garage.showGhosts,
  onDirections: (store) => { /* plan from store.lat/lon */ },
});
```

`/look.html` still uses `LOOK_FIXTURES` so the demo and screenshot harness do not wait on Overpass.

Types: live code uses Nard’s `Store` / `PlaceInfo` / `Ghost` from `src/lib/stores`, `src/lib/place-info`, `src/lib/live-ghosts`. `src/look/types.ts` stays a defensive optional mirror for fixtures.

## Hologram hook (Leon)

```ts
import { registerHologramRenderer } from "./look/hologram";
// Prefer registerSlideModels() — already called from the live HUD and the demo.

registerHologramRenderer("walmart", (el, { modelKey, color }) => {
  return () => { /* dispose three.js */ };
});
```

`modelKey` is Nard’s: a `brandKey` when a dedicated model exists, otherwise `generic-<category>`.

## Screenshots

Phone 390×844.

Fixture demo (`node tools/shoot-look.mjs docs/look <previewUrl>`):

| File | What |
|---|---|
| `docs/look/pins-night.png` | Store pins + ghosts, Night |
| `docs/look/card-full-night.png` | Walmart card with every field |
| `docs/look/card-empty-night.png` | Corner Mart empty states |
| `docs/look/card-loading-night.png` | Card shimmer + hologram well |
| `docs/look/pins-skel-night.png` | Skeleton pins while stores load |
| `docs/look/ghosts-night.png` | Ghost cars, closer |
| `docs/look/clusters-night.png` | Clustered fuel pins |
| `docs/look/clusters-out-night.png` | Zoomed-out cluster glow |
| `docs/look/motion-enter-night.png` | Card slide / expand mid-pose |
| `docs/look/motion-reveal-night.png` | Hologram reveal mid-pose |
| `docs/look/motion-drop-night.png` | Pin drop mid-pose |
| `docs/look/motion-select-night.png` | Selected pin pop + halo |
| `docs/look/pins-day.png` | Day theme pins |
| `docs/look/card-full-day.png` | Full card + logo well, Day |
| `docs/look/card-empty-day.png` | Empty card, Day |
| `docs/look/clusters-day.png` | Clusters, Day |
| `docs/look/search-card-night.png` | Search `#place-card` chrome, Night |
| `docs/look/search-results-night.png` | Search bar + results list, Night |
| `docs/look/card-closed-night.png` | Closed chip `Opens 5a` (Dunkin) |
| `docs/look/pins-collide-night.png` | Street-zoom pins, selected label wins |
| `docs/look/pins-cluster-tap-night.png` | After a cluster tap: winner label, no card |
| `docs/look/pins-skel-day.png` | Skeleton pins, Day contrast |
| `docs/look/search-empty-night.png` | Empty search: Home/Work + idle recents |
| `docs/look/search-no-results-night.png` | No-match suggest status |
| `docs/look/search-offline-night.png` | Offline fail sheet |

Live OSM (`node tools/shoot-look-live.mjs docs/look <previewUrl>`):

| File | What |
|---|---|
| `docs/look/live-pins-night.png` | Real `/api/stores` pins on the HUD |
| `docs/look/live-card-night.png` | Real place card from `/api/places` |

## Credits

- Map: OpenFreeMap / OpenMapTiles / OpenStreetMap.
- Stores: OpenStreetMap (ODbL) via Overpass.
- Place copy / photos: Wikidata + Wikimedia Commons when the brand has a page; OSM hours/website otherwise.
- Brand colors: public chain hex (Nard’s table). Marks are original monograms, not trademarks as artwork.
- Ghost silhouettes: `src/lib/vehicles.ts` (Slide Originals) + Leon hulls.
