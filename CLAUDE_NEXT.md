# Next agent prompt — Slide LOOK (paste this)

You are Grim on **Slide** (https://github.com/T0PK1DK/Slide). Vite + TypeScript + MapLibre. **No React.** Read `HANDOFF.md`, `TASKS.md`, `docs/DESIGN-RESEARCH.md`, and `docs/LOOK.md` first. Tokens only: `design/premium-glass-kit/css/tokens.css` → `src/styles/tokens.css`. Never add a CSS override layer on `src/styles.css`. Look CSS lives in `src/look/components.css` + `src/look/live.css`.

## What just shipped (do not redo)

Overnight LOOK polish on store pins, place cards, skeletons, hologram *presentation*, phone layout, transitions, and empty states. Additive only.

- **Pins:** teardrop map sprites, original two-letter monograms (`monogramPair` / `BRAND_MONOGRAM`), real category glyphs via `Path2D` + `categoryIconPath`. Card badge stays a circular disc. `pinImageId` still keys on the first letter.
- **Cards:** hologram sits in `.look-holo-stage` / `.look-holo-well` (ring + caption). Call / Website / Directions have icons. OSM hours format through `formatHours` (`src/look/hours.ts`). Photo strip uses `object-fit: contain` so Wikimedia logos don't crop ugly.
- **Loading:** teardrop skeleton pins, 3-tile photo shimmer, hologram-well shimmer, hours/address/desc lines. Demo: `?loading=1`, `?skel=1`, `slideLook.showLoading` / `showSkel`.
- **Phone:** sheet `max-height` ~64–68dvh, 8px gutters ≤430px, `--look-sheet-lift` raises compass/locate FABs by the real sheet height. Status pill hides while the card is open.
- **Motion:** `.look-sheet.is-open` slide-up. Honors `prefers-reduced-motion`.
- **Empty:** icon + the existing `PLACE_EMPTY` copy. Do not change those strings unless you update the tests that lock them.

`registerHologramRenderer` is unchanged. Leon's 3D models still mount in `[data-hologram]`. Nard's `/api/stores` + `/api/places` + live ghosts are unchanged.

## Do not

- Do not edit `functions/**`, `src/lib/stores/**`, `src/lib/place-info.ts`, `src/lib/live-ghosts/**`, or `supabase/**`.
- Do not change `registerHologramRenderer` / `registerGhostCarRenderer` signatures or `src/models/**`.
- Do not put fixtures on the live HUD. Fixtures stay on `/look.html` and in tests.
- Do not add React/Vue. Do not add another CSS layer. Do not add hex to `src/styles.css`.
- Do not merge the PR from an agent.

## Next look round (pick 1–2, keep additive)

Phone-first. Shoot 390×844 before/after with `tools/shoot-look.mjs` (and live OSM with `tools/shoot-look-live.mjs` if Overpass answers).

1. **Selected pin + hologram float.** Selected teardrop should read as *the* place (scale / brighter ring) without covering the map hologram. The float marker still uses Leon's slot; only move CSS/`offset`.
2. **Photo well.** Wikimedia often returns logos, not storefronts. Detect near-square / transparent marks and give them a contained well + “Logo” vs “Photo” caption. No new image API.
3. **Open-now + hours.** Chip and `formatHours` are there; add “closes 11p” when `openNow` + a parseable end time exist. Keep unknown as `Hours unknown`.
4. **Empty / error pills.** `LOOK_LIVE` copy is locked by tests that read the constants — you may improve the *visual* (icon, two-line wrap) more than the words.
5. **Cluster vs pin.** Fuel clusters (Shell/BP/Chevron) still collide at street zoom. Try a slightly smaller teardrop or category-tinted cluster, not a new source.
6. **Day theme.** `/look.html?look=day` is a warm light preview, not Sand. Check contrast on badges, empty photos, and the hologram well.
7. **Search `#place-card` vs `#look-place-card`.** Search pick still uses the older sheet. Do not restyle it in the look CSS file. If you touch it, use tokens in `src/styles.css` components — and don't fight the look sheet.

## How to verify

```bash
npm test          # must stay ≥396
npm run build     # must pass
npm run preview   # then:
node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/
```

Demo: `/look.html`, `?place=osm:node/123`, `?empty=1`, `?loading=1`, `?skel=1`, `?look=day`.

Update `HANDOFF.md` (layout + session log), check the box in `TASKS.md`, replace this file with the next pasteable prompt, and open a PR with phone screenshots plus a plain-English list of changes.
