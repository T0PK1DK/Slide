# Next agent notes — Slide look live

Grim wired the look HUD to Nard’s live endpoints. Branch `grim/slide-look-live-data`. Real app, not just `/look.html`.

## Shipped

- `src/look/live.ts` + `src/look/store-feed.ts`: `GET /api/stores?tiles=` (debounce 600 ms, zoom ≥ 12, 8 min client tile cache) and `GET /api/places` (30 min client place cache). Skeleton pins + card shimmer while Overpass / Wikidata are slow. Empty / error pills; retry does not use a failed-tile cache. Map is never blocked.
- Leon’s `registerSlideModels()` runs on the live HUD so holograms and ghost hulls mount in the real slots.
- Vite `storesPlacesApi` stand-in so `npm run dev` / `preview` hit the same `loadStoresForRequest` / `loadPlaceInfo` as Pages. Did **not** rewrite `functions/api/stores.ts` or `functions/api/places.ts`.
- Fixtures remain on `/look.html` and in tests only.

## Ghosts

`watchLiveGhosts` / `listLiveGhosts` are exposed (`src/lib/live-ghosts/client.ts`) and the live HUD subscribes **when `cloudConfigured()`**. This environment / a keyless build draws **no** live ghost cars — that is expected. Rough ~1 km `mountFriends` presence is unchanged. Pace-replay `src/lib/ghosts.ts` is still unwired (same as before). Apply `supabase/migrations/20261018000000_ghost_sharing.sql` on the live project before friend ghosts can appear.

## Do not

- Do not merge this PR from an agent.
- Do not edit `functions/**`, `src/lib/stores/**`, `src/lib/place-info.ts`, `src/lib/live-ghosts/**`, or `supabase/**` for look work.
- Do not put fixtures on the live HUD.
- Do not add a CSS override layer on `src/styles.css`. Live look CSS is `src/look/live.css` → `components.css` (tokens only).

## Follow-ups

- If Overpass is cold, first pins can take several seconds — the skeleton is the intended state, not a hang.
- Drive / Arrive hide pins, sheet, and ghosts (same as friends).
- `#place-card` is still the search result sheet; store taps use `#look-place-card`.
