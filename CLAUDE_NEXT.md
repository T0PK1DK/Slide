# Next agent prompt — Slide LOOK (paste this)

You are Grim on **Slide** (https://github.com/T0PK1DK/Slide). Vite + TypeScript + MapLibre. **No React.** Read `HANDOFF.md`, `TASKS.md`, `docs/DESIGN-RESEARCH.md`, and `docs/LOOK.md` first. Tokens only: `design/premium-glass-kit/css/tokens.css` → `src/styles/tokens.css`. Never add a CSS override layer on `src/styles.css`. Look CSS lives in `src/look/components.css` + `src/look/live.css`.

Stay on PR **#59** (`cursor/slide-look-polish-f924`) unless the owner opens a new look branch. Rebase on `main` first if `main` moved.

## What just shipped (do not redo)

Seven look rounds on #59. Additive only. `registerHologramRenderer` unchanged. Nard's `/api/stores` + `/api/places` + live ghosts unchanged.

**Round 1 — chrome:** teardrop pins, two-letter monograms, hologram stage, card icons, `formatHours`, skeletons, phone FAB lift, empty icons.

**Round 2–3 — motion:** pin drop / select pop / halo, card slide-expand, hologram reveal CSS, cluster glow. Demo `?motion=enter|reveal|drop|select`.

**Round 4 — card daylight:** Logo vs Photo well, `Open · closes 11p`, day contrast.

**Round 5 — unify + pins:** search `#place-card` shares look-sheet chrome; reduced-motion stills; 128px sprites.

**Round 6 — collide + search:**
- Pin labels do not overlap. `symbol-sort-key` prefers selected, then nearest-to-center. Stacked neighbors fade (`rankPins`, `PIN_COLLIDE_M` 56).
- Closed chip: `Opens 8a` when `openNow === false` and OSM start parses. `Hours unknown` and bare `Closed` stay.
- Search `#search-card` handle + suggest rows use the same type as the cards (light title, mono uppercase address, distance pill). Styled in `src/styles.css` only.

**Round 7 — recents + cluster tap + edges:**
- Home / Work / recents are two-line suggest rows (`src/hud/search-rows.ts`). Empty Home/Work: "Save a place on this phone". Empty recents: `SEARCH.idle` ("Places you pick will show here"). Clicks use `data-label`, not concatenated `textContent`.
- Cluster tap on the disc **and** glow: `getClusterLeaves` → `pickClusterWinner` → `focusId` (label priority, no `onSelect`, no card / hologram / select pop). `easeTo` at least `CLUSTER_MAX_ZOOM + 0.35`. Reduced-motion duration 0. Invalid `cluster_id` is ignored.
- Edge pass: search loading shimmer + empty/no-results copy, offline/loc fail-sheet handle + light title + 44px filled close, long names ellipsis/2-line clamp, `--touch` taps on recents/chips/status/fail actions, day skeleton + live-status contrast.

Never weaken or delete a test. 420+ must keep passing.

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
3. **Cluster after expand.** If leaves are still stacked at the expansion zoom, keep fading non-winners and consider a second tap-to-select (today cluster tap never selects).
4. **Day search sheet.** `#search-card` / recents / fail sheets under `html[data-look=day]` if the live HUD ever uses the look-day tokens.

## How to verify

```bash
npm test          # must stay ≥421
npm run build
npm run preview
node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/
```

Demo: `/look.html`, `?place=`, `?empty=1`, `?loading=1`, `?skel=1`, `?motion=enter|reveal|drop|select`, `?look=day`. Closed chip: Dunkin fixture. Search: main HUD `#search-card` + `#to-suggest`. Recents: `#recents` / `#chip-home` / `#chip-work`. Cluster: zoom ~13.4 then tap a fuel disc. Demo `focusPin(id)` ranks a winner without selecting.

Update `HANDOFF.md` + this file, push #59, list changes with phone screenshots. Do not merge.
