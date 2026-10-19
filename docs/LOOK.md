# Slide look — store pins, place cards, hologram, ghost cars

Look HUD for King’s wishlist. **Nard owns the data** (`/api/stores`, `/api/places`, live ghosts). **Leon owns 3D models**. The real app (`index.html`) paints pins and the place sheet from those endpoints. Fixtures stay on **`/look.html`** and in tests.

Demo: **`/look.html`** (`?look=day`, `?place=osm:node/123`, `?empty=1`). Phone-first. Night is default; Day is a warm light preview.

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
| Store pins | `src/map/store-pins.ts`, `src/look/marks.ts` | Brand-colored monogram badge. Unknown chains use the category glyph + category color. MapLibre clustering (`clusterRadius` 52, `clusterMaxZoom` 14). Labels from zoom 15. |
| Place card | `src/hud/place-card.ts` | Bottom sheet: hologram slot, name, badge, open-now chip, hours, address, Call / Website / Directions, photo strip with credits, description. Empty-states every missing field. |
| Hologram | `src/look/hologram.ts` | Slot above the selected pin **and** at the top of the card. Leon fills `registerHologramRenderer`. Honors `prefers-reduced-motion`. |
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
| `docs/look/ghosts-night.png` | Ghost cars, closer |
| `docs/look/clusters-night.png` | Clustered fuel pins |
| `docs/look/pins-day.png` | Day theme |
| `docs/look/card-full-day.png` | Full card, Day |

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
