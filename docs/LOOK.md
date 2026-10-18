# Slide look — store pins, place cards, hologram, ghost cars

Look-only pass for King’s wishlist. **Nard owns the data** (OSM stores, place info, live ghosts). **Leon owns 3D models**. This PR paints the HUD against local fixtures that match Nard’s contract in `docs/DATA_SHAPES.md` (backend PR).

Demo: **`/look.html`** (also `look.html?look=day`, `?place=osm:node/123`, `?empty=1`). Phone-first. Night is default; Day is a warm light preview.

## What you get

| Piece | Files | Behavior |
|---|---|---|
| Store pins | `src/map/store-pins.ts`, `src/look/marks.ts` | Brand-colored monogram badge. Unknown chains use the category glyph + category color. MapLibre clustering (`clusterRadius` 52, `clusterMaxZoom` 14). Labels from zoom 15. Collision via `icon-allow-overlap: false`. |
| Place card | `src/hud/place-card.ts` | Bottom sheet: hologram slot, name, badge, open-now chip, hours, address, Call / Website / Directions, photo strip with credits, description. Opens on pin tap, **Stopped**, or **At destination**. |
| Hologram | `src/look/hologram.ts` | Slot above the selected pin **and** at the top of the card. Default = soft glowing, slowly rotating store outline. Honors `prefers-reduced-motion`. |
| Ghost cars | `src/map/ghost-car.ts` | Color, name tag, heading arrow. Visual only. Uses garage ride silhouettes (`carModelKey`). |

Logos are **bundled monograms**, not hotlinked brand files or paid image APIs. Sample photos are original SVG stills (`src/look/photos.ts`) credited “Slide look kit · sample still”.

## Fixtures ↔ Nard’s data

Types in `src/look/types.ts` mirror Nard’s `Store`, `PlaceInfo`, and `Ghost` (lat/lon **or** `position`, because the wishlist prompt used both). Any field can be missing.

```ts
import { LOOK_FIXTURES, lookDataFromNard } from "./look/fixtures";
import { mountStorePins } from "./map/store-pins";
import { mountPlaceCard } from "./hud/place-card";
import { mountGhostCars } from "./map/ghost-car";

// After Nard’s backend PR merges, drop LOOK_FIXTURES:
const data = lookDataFromNard(
  await loadStoresNear(lat, lon),
  await Promise.all(stores.map(fetchPlaceInfo)),
  await listLiveGhosts(),
);
pins.setStores(data.stores);
ghosts.setGhosts(data.ghosts);
card.show(store, data.places[store.id]);
```

Do **not** import `src/lib/stores/*`, `src/lib/place-info.ts`, or `src/lib/live-ghosts/*` from this look PR — those files live on Nard’s branch.

## Hologram hook (Leon)

```ts
import { registerHologramRenderer } from "./look/hologram";

const stop = registerHologramRenderer("walmart", (el, { modelKey, color }) => {
  // mount low-poly model into `el`
  return () => { /* dispose three.js */ };
});

registerHologramRenderer("*", (el, opts) => {
  // fallback for generic-grocery, generic-fuel, …
});
```

`modelKey` is Nard’s: a `brandKey` when a dedicated model exists (`walmart`, `target`, `publix`, `starbucks`, `mcdonalds`, `shell`, `wawa`, `home-depot`, `cvs`, `walgreens`), otherwise `generic-<category>`.

## Screenshots

Phone 390×844, from `node tools/shoot-look.mjs docs/look <previewUrl>`:

| File | What |
|---|---|
| `docs/look/pins-night.png` | Store pins + ghosts, Night |
| `docs/look/card-full-night.png` | Walmart card with every field |
| `docs/look/card-empty-night.png` | Corner Mart empty states |
| `docs/look/ghosts-night.png` | Ghost cars, closer |
| `docs/look/clusters-night.png` | Clustered fuel pins |
| `docs/look/pins-day.png` | Day theme |
| `docs/look/card-full-day.png` | Full card, Day |

## Credits

- Map: OpenFreeMap / OpenMapTiles / OpenStreetMap.
- Brand colors: public chain hex (same table as Nard). Marks are original monograms, not trademarks as artwork.
- Sample photos: Slide look kit SVGs, not Wikimedia.
- Ghost silhouettes: `src/lib/vehicles.ts` (Slide Originals).
