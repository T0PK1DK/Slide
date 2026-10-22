# Next agent prompt — Slide LOOK (paste this)

You are Grim on **Slide** (https://github.com/T0PK1DK/Slide). Vite + TypeScript + MapLibre. **No React.** Read `HANDOFF.md`, `TASKS.md`, `docs/DESIGN-RESEARCH.md`, and `docs/LOOK.md` first. Tokens only: `design/premium-glass-kit/css/tokens.css` → `src/styles/tokens.css`. Never add a CSS override layer on `src/styles.css`. Look CSS lives in `src/look/components.css` + `src/look/live.css`.

Stay on PR **#59** (`cursor/slide-look-polish-f924`) unless the owner opens a new look branch. Rebase on `main` first if `main` moved.

## What just shipped (do not redo)

Nine look rounds on #59. Additive only. `registerHologramRenderer` unchanged. Nard's `/api/stores` + `/api/places` + live ghosts unchanged.

**Round 1 — chrome:** teardrop pins, two-letter monograms, hologram stage, card icons, `formatHours`, skeletons, phone FAB lift, empty icons.

**Round 2–3 — motion:** pin drop / select pop / halo, card slide-expand, hologram reveal CSS, cluster glow.

**Round 4 — card daylight:** Logo vs Photo well, `Open · closes 11p`, day contrast.

**Round 5 — unify + pins:** search `#place-card` shares look-sheet chrome; reduced-motion stills; 128px sprites.

**Round 6 — collide + search:** pin label rank, `Opens 8a`, search rows match cards.

**Round 7 — recents + cluster tap + edges:** two-line Home/Work/recents, cluster tap zooms without selecting, empty/offline/long-name/44px.

**Round 8 — live photo well + search extras:** P154 Logo, short Wikimedia credit, search extras only when a store within 90 m already has them.

**Round 9 — cluster after expand:**
- First tap: `clusterTapPlan` expands to `expansionZoom + CLUSTER_EXPAND_PAD` (0.45), focuses the winner, quiet halo, no card / hologram / select pop.
- Stacked leaves fade with `PIN_COLLIDE_FOCUS_M` 80 (wider than the 56 m selected collide).
- Focused pin uses the hot size on the rest layer. `focus()` now `apply()`s so halo + size paint.
- Second tap on the same already-open cluster (`focusId` matches winner and zoom would barely move) selects that winner (`onSelect`).
- If the child cluster still needs zoom, the second tap expands again.

Never weaken or delete a test. 426+ must keep passing.

## Do not

- Do not edit `functions/**`, `src/lib/stores/**`, `src/lib/place-info.ts`, `src/lib/live-ghosts/**`, or `supabase/**`.
- Do not change `registerHologramRenderer` / `registerGhostCarRenderer` signatures or `src/models/**`.
- Do not put fixtures on the live HUD.
- Do not restyle `#place-card` from `src/look/*.css`.
- Do not add React/Vue. Do not add another CSS layer. Do not add hex to `src/styles.css`.
- Do not merge or deploy.

## Next look round (pick 1–2)

Phone-first at 390×844. `node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/`. Live: `node tools/shoot-look-live.mjs docs/look http://127.0.0.1:4173/`.

1. **Day search sheet.** `#search-card` / recents / fail sheets / extras under `html[data-look=day]` if the live HUD ever uses the look-day tokens.
2. **Photo strip overflow.** More than two live Commons stills on a 390px card — peek, snap, and credit that stay readable.
3. **Search extras empty.** When extrasFor misses, keep the card as name + address only (already). A dest that *is* a store but tiles have not landed yet could retry once after `refresh`.
4. **Focus halo day stroke.** The quiet focus ring should read on cream as well as night.

## How to verify

```bash
npm test          # must stay ≥426
npm run build
npm run preview
node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/
```

Demo: `/look.html` zoom ~13.4, tap a fuel disc — expands, Shell (or nearest) keeps the label, neighbors fade. Tap the same disc again after the camera settles — card opens. `focusPin(id)` paints the quiet halo. `?look=day`.

Update `HANDOFF.md` + this file, push #59, list changes with phone screenshots. Do not merge.
