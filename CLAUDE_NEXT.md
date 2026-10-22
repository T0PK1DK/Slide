# Next agent prompt — Slide LOOK (paste this)

You are Grim on **Slide** (https://github.com/T0PK1DK/Slide). Vite + TypeScript + MapLibre. **No React.** Read `HANDOFF.md`, `TASKS.md`, `docs/DESIGN-RESEARCH.md`, and `docs/LOOK.md` first. Tokens only: `design/premium-glass-kit/css/tokens.css` → `src/styles/tokens.css`. Never add a CSS override layer on `src/styles.css`. Look CSS lives in `src/look/components.css` + `src/look/live.css`.

Stay on PR **#59** (`cursor/slide-look-polish-f924`) unless the owner opens a new look branch. Rebase on `main` first if `main` moved.

## What just shipped (do not redo)

Eight look rounds on #59. Additive only. `registerHologramRenderer` unchanged. Nard's `/api/stores` + `/api/places` + live ghosts unchanged.

**Round 1 — chrome:** teardrop pins, two-letter monograms, hologram stage, card icons, `formatHours`, skeletons, phone FAB lift, empty icons.

**Round 2–3 — motion:** pin drop / select pop / halo, card slide-expand, hologram reveal CSS, cluster glow. Demo `?motion=enter|reveal|drop|select`.

**Round 4 — card daylight:** Logo vs Photo well, `Open · closes 11p`, day contrast.

**Round 5 — unify + pins:** search `#place-card` shares look-sheet chrome; reduced-motion stills; 128px sprites.

**Round 6 — collide + search:** pin label rank, `Opens 8a`, search rows match cards.

**Round 7 — recents + cluster tap + edges:** two-line Home/Work/recents, cluster tap zooms without selecting, empty/offline/long-name/44px.

**Round 8 — live photo well + search extras:**
- Real `/api/places` Wikimedia marks: P154 (`source: wikidata`) is Logo. Credit shortens to “Wikimedia”. Square marks vs wide wordmarks. `referrerpolicy=no-referrer`. Logos sort first.
- Search `#place-card` extras (`src/hud/place-extras.ts`) only when a live store is within 90 m: hours if `store.hours`, open chip if `openNow` is boolean, photo well if photos exist. Never invent. Look CSS still does not target `#place-card`.

Never weaken or delete a test. 424+ must keep passing.

## Do not

- Do not edit `functions/**`, `src/lib/stores/**`, `src/lib/place-info.ts`, `src/lib/live-ghosts/**`, or `supabase/**`.
- Do not change `registerHologramRenderer` / `registerGhostCarRenderer` signatures or `src/models/**`.
- Do not put fixtures on the live HUD.
- Do not restyle `#place-card` from `src/look/*.css`.
- Do not add React/Vue. Do not add another CSS layer. Do not add hex to `src/styles.css`.
- Do not merge or deploy.

## Next look round (pick 1–2)

Phone-first at 390×844. `node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/`. Live: `node tools/shoot-look-live.mjs docs/look http://127.0.0.1:4173/`.

1. **Cluster after expand.** If leaves are still stacked at the expansion zoom, keep fading non-winners and consider a second tap-to-select (today cluster tap never selects).
2. **Day search sheet.** `#search-card` / recents / fail sheets / extras under `html[data-look=day]` if the live HUD ever uses the look-day tokens.
3. **Photo strip overflow.** More than two live Commons stills on a 390px card — peek, snap, and credit that stay readable.
4. **Search extras empty.** When extrasFor misses, keep the card as name + address only (already). A dest that *is* a store but tiles have not landed yet could retry once after `refresh`.

## How to verify

```bash
npm test          # must stay ≥424
npm run build
npm run preview
node tools/shoot-look.mjs docs/look http://127.0.0.1:4173/
node tools/shoot-look-live.mjs docs/look http://127.0.0.1:4173/
```

Demo: `/look.html`, `?place=`, `?empty=1`, `?loading=1`, `?skel=1`, `?motion=enter|reveal|drop|select`, `?look=day`. Live HUD: pin a Publix / Walmart — Wikimedia logo well. Search `#place-card` extras: Directions from a store pin, or a dest within 90 m of a loaded store.

Update `HANDOFF.md` + this file, push #59, list changes with phone screenshots. Do not merge.
