# Next agent prompt — Slide LOOK (paste this)

You are Grim on **Slide** (https://github.com/T0PK1DK/Slide). Vite + TypeScript + MapLibre. **No React.** Read `HANDOFF.md`, `TASKS.md`, `docs/DESIGN-RESEARCH.md`, and `docs/LOOK.md` first. Tokens only: `design/premium-glass-kit/css/tokens.css` → `src/styles/tokens.css`. Never add a CSS override layer on `src/styles.css`. Look CSS lives in `src/look/components.css` + `src/look/live.css`.

Stay on PR **#59** (`cursor/slide-look-polish-f924`) unless the owner opens a new look branch. Rebase on `main` first if `main` moved.

## What just shipped (do not redo)

Three look rounds on #59. Additive only. `registerHologramRenderer` unchanged. Nard's `/api/stores` + `/api/places` + live ghosts unchanged.

**Round 1 — chrome:** teardrop pins, two-letter monograms, hologram stage, card icons, `formatHours`, skeletons, phone FAB lift, empty icons.

**Round 2 — motion:** pin drop, selected layer + halo, card slide/expand, hologram reveal CSS, cluster glow.

**Round 3 — motion refine:**
- Pin drop lift 28px / 560ms; `setDropProgress` freezes a mid-pose without restarting `setStores`.
- Selected pin overshoot pop (`pinSelectScale` / `setSelectProgress`) + click on the selected layer.
- Hologram reveal bloom, scan, and ring on `.look-holo-stage.is-reveal` — do not change the register hook.
- Zoomed-out clusters: glow radius larger than the disc, map-aligned, stronger stroke/count. Demo `showGhosts(false)` so cluster shots are readable.
- Demo: `?motion=enter|reveal|drop|select`, `slideLook.previewMotion` / `showGhosts`.

Never weaken or delete a test. 400+ must keep passing.

## Do not

- Do not edit `functions/**`, `src/lib/stores/**`, `src/lib/place-info.ts`, `src/lib/live-ghosts/**`, or `supabase/**`.
- Do not change `registerHologramRenderer` / `registerGhostCarRenderer` signatures or `src/models/**`.
- Do not put fixtures on the live HUD.
- Do not add React/Vue. Do not add another CSS layer. Do not add hex to `src/styles.css`.
- Do not merge or deploy.

## Next look round (pick 1–2)

Phone-first at 390×844. `node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/`.

1. **Photo well.** Wikimedia often returns logos. Detect near-square / transparent marks and caption “Logo” vs “Photo”. No new image API.
2. **Open-now + hours.** Add “closes 11p” when `openNow` + a parseable end time exist. Keep `Hours unknown`.
3. **Day contrast.** `/look.html?look=day` — badges, empty photos, hologram well, cluster discs.
4. **Search `#place-card` vs `#look-place-card`.** Do not restyle the search sheet from look CSS.
5. **Reduced-motion audit.** Pin drop, select pop, halo, card expand, hologram reveal, cluster glow — walk the live HUD too.

## How to verify

```bash
npm test          # must stay ≥400
npm run build
npm run preview
node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/
```

Demo: `/look.html`, `?place=`, `?empty=1`, `?loading=1`, `?skel=1`, `?motion=enter|reveal|drop|select`, `?look=day`.

Update `HANDOFF.md` + this file, push #59, list changes with phone screenshots. Do not merge.
