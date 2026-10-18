# Next agent notes — Slide look

Grim shipped the **look** for King’s store / place / hologram / ghost-car wishlist. Branch `grim/slide-look-pins-cards`. Demo `/look.html`. Fixtures only.

## Do not

- Do not merge this PR from an agent.
- Do not edit `functions/**`, `src/lib/place.ts`, `src/lib/ghosts.ts`, `src/lib/presence.ts`, `src/lib/social.ts`, or `supabase/**` for look work.
- Do not hotlink paid logo APIs. Monograms live in `src/look/marks.ts`.

## Leon — 3D holograms

`src/look/hologram.ts`:

```ts
registerHologramRenderer(modelKey | "*", (el, { modelKey, color }) => dispose)
```

Slots already exist: above the selected pin (`.look-holo-float`) and at the top of the place card (`[data-hologram]`). Default outline spins unless `prefers-reduced-motion`. `modelKey` matches Nard’s `KNOWN_STORE_MODELS` plus `generic-<category>`.

Ghost markers already pass `carModelKey` (garage ids: slipstream, brawler, hatch, …).

## Nard — swap fixtures

When the wishlist backend PR is on `main`, replace `LOOK_FIXTURES` in `src/look/demo.ts` (and later `src/main.ts`) with `lookDataFromNard(loadStoresNear, fetchPlaceInfo, listLiveGhosts / watchLiveGhosts)`. Types in `src/look/types.ts` are the contract. Details: `docs/LOOK.md`.

## Grim follow-up

Wire pins + the new place sheet into the live HUD **after** Nard’s hooks exist. Keep `#place-card` in `shell.ts` until that swap; this PR’s sheet is `#look-place-card` so the two can sit side by side. No new CSS override layer on `src/styles.css` — look styles stay in `src/look/look.css` until that wire-up.
