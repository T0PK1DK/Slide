# Next agent prompt — Slide LOOK (paste this)

You are Grim on **Slide** (https://github.com/T0PK1DK/Slide). Vite + TypeScript + MapLibre. **No React.** Read `HANDOFF.md`, `TASKS.md`, `docs/DESIGN-RESEARCH.md`, and `docs/LOOK.md` first. Tokens only: `design/premium-glass-kit/css/tokens.css` → `src/styles/tokens.css`. Never add a CSS override layer on `src/styles.css`. Look CSS lives in `src/look/components.css` + `src/look/live.css`.

Stay on PR **#59** (`cursor/slide-look-polish-f924`) unless the owner opens a new look branch. Rebase on `main` first if `main` moved.

## What just shipped (do not redo)

Six look rounds on #59. Additive only. `registerHologramRenderer` unchanged. Nard's `/api/stores` + `/api/places` + live ghosts unchanged.

**Round 1 — chrome:** teardrop pins, two-letter monograms, hologram stage, card icons, `formatHours`, skeletons, phone FAB lift, empty icons.

**Round 2–3 — motion:** pin drop / select pop / halo, card slide-expand, hologram reveal CSS, cluster glow. Demo `?motion=enter|reveal|drop|select`.

**Round 4 — card daylight:** Logo vs Photo well, `Open · closes 11p`, day contrast.

**Round 5 — unify + pins:** search `#place-card` shares look-sheet chrome; reduced-motion stills; 128px sprites.

**Round 6 — collide + search:**
- Pin labels do not overlap. `symbol-sort-key` prefers selected, then nearest-to-center. Stacked neighbors fade (`rankPins`, `PIN_COLLIDE_M` 56).
- Closed chip: `Opens 8a` when `openNow === false` and OSM start parses. `Hours unknown` and bare `Closed` stay.
- Search `#search-card` handle + suggest rows use the same type as the cards (light title, mono uppercase address, distance pill). Styled in `src/styles.css` only.

Never weaken or delete a test. 410+ must keep passing (this round adds tests).

## Do not

- Do not edit `functions/**`, `src/lib/stores/**`, `src/lib/place-info.ts`, `src/lib/live-ghosts/**`, or `supabase/**`.
- Do not change `registerHologramRenderer` / `registerGhostCarRenderer` signatures or `src/models/**`.
- Do not put fixtures on the live HUD.
- Do not restyle `#place-card` from `src/look/*.css`.
- Do not add React/Vue. Do not add another CSS layer. Do not add hex to `src/styles.css`.
- Do not merge or deploy.

## Next look round (pick 1–2)

Phone-first at 390×844. `node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/`.

1. **Live photo well.** A real `/api/places` Wikimedia logo on the HUD (no fixture). Keep Nard's Function unchanged.
2. **Search card extras.** Optional hours/open chip on `#place-card` only when Nard already has them on the hit — do not invent.
3. **Recents as rows.** Saved Home/Work/recents in the open search sheet should use the same two-line row as suggest (already started).
4. **Cluster tap.** After expanding a fuel cluster, keep the winner label and fade the rest without a second select.

## How to verify

```bash
npm test          # must stay ≥410
npm run build
npm run preview
node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/
```

Demo: `/look.html`, `?place=`, `?empty=1`, `?loading=1`, `?skel=1`, `?motion=enter|reveal|drop|select`, `?look=day`. Closed chip: Dunkin fixture. Search: main HUD `#search-card` + `#to-suggest`.

Update `HANDOFF.md` + this file, push #59, list changes with phone screenshots. Do not merge.
