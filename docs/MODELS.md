# Slide models — store holograms + ghost cars

Leon’s 3D pass for King’s store / ghost wishlist. **Grim owns the slots** (`registerHologramRenderer` in `src/look/hologram.ts`, ghost markers in `src/map/ghost-car.ts`). **Nard owns the data** (`docs/DATA_SHAPES.md` on the backend PR). This package is new files plus one registration call so it can merge after #55 and #56.

Hook-in (already called from `src/look/demo.ts`):

```ts
import { registerSlideModels } from "../models";
registerSlideModels();
```

That registers every store key and `"*"` on Grim’s hologram map, and the same shape for ghost cars via `registerGhostCarRenderer`. three.js stays lazy until a slot mounts. No WebGL → SVG fallback, then dispose.

Logos are **not** used. Chains read as storefront / building silhouettes, tinted with the brand `color` Nard sends.

## Store hologram keys

`modelKey` is the brand slug when a dedicated model exists, otherwise `generic-<category>`. Unknown keys paint `"*"`.

### Brand models (Nard’s ~32 US chains)

| Key | Silhouette |
|---|---|
| `walmart` | Wide supercenter, flat roof, entry pylons |
| `target` | Box + red-ball facade |
| `costco` | Warehouse with ridge roof + dock |
| `kroger` | Supermarket + blade sign |
| `publix` | Center peak between two wings |
| `whole-foods` | Market + stacked canopy discs |
| `aldi` | Compact grocery cube |
| `trader-joes` | Cottage roof + chimney |
| `safeway` | Supermarket + arched entry |
| `albertsons` | Supermarket + tall pylon |
| `cvs` | Pharmacy box, awning, plus mark |
| `walgreens` | Corner turret |
| `rite-aid` | Pharmacy + vertical blade |
| `shell` | Canopy + scalloped edge + pumps |
| `exxon` | Canopy + stacked bars + pumps |
| `chevron` | V-plate canopy + pumps |
| `bp` | Disc canopy + pumps |
| `circle-k` | C-store + canopy + round window |
| `wawa` | Rounded c-store + canopy |
| `7-eleven` | Convenience box + striped awning |
| `mcdonalds` | Arches roof |
| `burger-king` | Stacked bun roof |
| `wendys` | Steep sloped roof |
| `taco-bell` | Arcade + bell form |
| `chick-fil-a` | A-frame roof |
| `subway` | Long thin shop |
| `chipotle` | Industrial box + stack |
| `starbucks` | Cafe + round window |
| `dunkin` | Awning + twin cups |
| `home-depot` | Orange warehouse + shed |
| `lowes` | Blue gable warehouse |
| `best-buy` | Electronics box + mast |

Nard’s `KNOWN_STORE_MODELS` on #55 is a 10-chain starter (`walmart`, `target`, `publix`, `starbucks`, `mcdonalds`, `shell`, `wawa`, `home-depot`, `cvs`, `walgreens`). The rest still have models here; until he expands that list those OSM hits arrive as `generic-<category>` and use the generic silhouette.

### Category generics + fallback

| Key | Use |
|---|---|
| `generic-grocery` | Peaked market |
| `generic-pharmacy` | Box + plus |
| `generic-fuel` | Canopy + one pump |
| `generic-fast_food` | Box + drive-thru wing |
| `generic-coffee` | Cafe + cup |
| `generic-retail` | Storefront |
| `generic-other` | House |
| `*` | Smaller house (unknown key) |

Resolution: brand model → `generic-<category>` → `"*"`.

## Ghost car keys

Nard sends garage ids (`slipstream`, `brawler`, `hatch`, `ridge`, `hauler`, `classic`, …). Those map onto five hulls:

| `carModelKey` | Hull |
|---|---|
| `sedan`, `hatch`, `classic`, `glider`, `nimbus` | sedan |
| `suv`, `ridge` | SUV |
| `pickup`, `hauler` | pickup |
| `sports`, `slipstream`, `brawler` | sports |
| anything else / `default` | default wedge |

Color comes from `color`. Heading is applied by Grim’s marker wrapper (`headingDeg`). The mesh is translucent; `speedMps` only lifts opacity a little.

```ts
import { registerGhostCarRenderer } from "../models";

registerGhostCarRenderer("sports", (el, { carModelKey, color }) => {
  return () => { /* dispose */ };
});
registerGhostCarRenderer("*", (el, opts) => { /* fallback */ });
```

## How to add a store model

1. Add the slug to `HOLOGRAM_BRAND_KEYS` in `src/models/keys.ts` (and `BRAND_CATEGORY` if it is a chain).
2. Add a `StoreRecipe` in `src/models/store-meshes.ts` — a few `box` / `cyl` / `cone` / `sphere` / `torus` parts, ground at y = 0. Keep `estimateStoreTriangles(key) ≤ 250`.
3. Registration is automatic (`registerSlideModels` walks the key lists).
4. Ask Nard to add the slug to `KNOWN_STORE_MODELS` so live OSM rows send `modelKey = brandKey` instead of `generic-<category>`.
5. Do **not** drop in a trademarked logo file. Suggest the chain with massing and the passed hex only.

## How to add a ghost hull

1. Add the hull name to `GHOST_CAR_KEYS` and a part list in `src/models/car-meshes.ts`.
2. Point garage ids at it in `GHOST_CAR_ALIASES`.
3. Keep it box-and-cylinder; these draw on the map at 28×48.

## Runtime rules

- Shared materials: one fill + one edge per slot, every mesh reuses them.
- Dispose renderer, geometries, materials, and the RAF on cleanup.
- `prefers-reduced-motion` skips float / spin / scanline travel.
- Phone budget: low segment counts, `MeshBasicMaterial` (no lights), pixel ratio ≤ 1.5, no shadows.
- Files live under `src/models/`. Do not edit `functions/**`, `src/lib/stores/**`, `src/lib/live-ghosts/**`, or `supabase/**` for model work.
