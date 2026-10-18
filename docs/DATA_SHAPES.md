# Slide data shapes (wishlist backend)

Free sources only. No secrets, no paid APIs. Grim owns pins / place cards. Leon owns 3D store + ghost-car models. These types are the contract.

Types live in:

- `src/lib/stores/types.ts` + `src/lib/stores/brands.ts`
- `src/lib/live-ghosts/types.ts`
- `src/lib/place-info.ts`

## Store

Major US chains from OpenStreetMap (ODbL) via public Overpass. `/api/stores` tiles the map or route (~0.1°), caches 1 h, and backs off on 429/5xx.

```ts
type StoreCategory = "grocery" | "pharmacy" | "fuel" | "fast_food" | "coffee" | "retail" | "other";

type Store = {
  id: string;            // "osm:node/123" | "osm:way/…" | "osm:relation/…"
  name: string;
  brand: string;
  brandKey: string;      // lowercase slug, e.g. "walmart"
  category: StoreCategory;
  lat: number;
  lon: number;
  address?: string;
  hours?: string;
  phone?: string;
  website?: string;
  color: string;         // "#rrggbb" from the brand table
  logo?: string;         // Wikimedia Commons FilePath URL
  modelKey: string;      // brandKey if in KNOWN_STORE_MODELS, else "generic-"+category
};
```

Brand match order: `brand:wikidata` / `operator:wikidata` (name-suggestion-index) → `brand` / `name` aliases → slug of brand or name.

### Brand table (~32 US chains)

Each row: `brandKey`, display `name`, `color`, primary `wikidata` id. See `BRANDS` in `src/lib/stores/brands.ts`.

### Sample Store

```json
{
  "id": "osm:node/123",
  "name": "Walmart Supercenter",
  "brand": "Walmart",
  "brandKey": "walmart",
  "category": "grocery",
  "lat": 26.0112,
  "lon": -80.1436,
  "address": "1200 S Federal Hwy",
  "hours": "Mo-Su 06:00-23:00",
  "phone": "+1 954-555-0100",
  "website": "https://www.walmart.com",
  "color": "#0071ce",
  "logo": "https://commons.wikimedia.org/wiki/Special:FilePath/Walmart_logo.svg?width=256",
  "modelKey": "walmart"
}
```

Unknown chain with no 3D model:

```json
{
  "id": "osm:node/99",
  "name": "Kroger",
  "brand": "Kroger",
  "brandKey": "kroger",
  "category": "grocery",
  "lat": 25.77,
  "lon": -80.19,
  "color": "#0066b2",
  "modelKey": "generic-grocery"
}
```

Hooks (no HUD): `loadStoresNear`, `loadStoresInBbox`, `loadStoresAlongRoute`.

## Ghost

Private live location. Opt-in only. Share only after **invite + accept**. Pause / stop anytime (deletes the latest point, keeps approvals until revoke). Latest point only; rows older than **45 s** are dropped. Client + server throttle **2 s**; send every **2–5 s** while moving.

Uses the existing Supabase project (Realtime on `public.ghosts` + RLS). No Durable Object. Off when accounts are not configured — same as rough presence.

```ts
type Ghost = {
  userId: string;
  displayName: string;
  carModelKey: string;   // garage vehicle id (slipstream, …) for Leon
  color: string;
  lat: number;
  lon: number;
  headingDeg: number;
  speedMps: number;
  updatedAt: number;     // epoch ms
};
```

This is **not** the rough ~1 km `FriendSpot` in `src/lib/presence.ts`. Ghosts are precise and hidden from anyone without an accepted invite.

### Sample Ghost

```json
{
  "userId": "11111111-1111-1111-1111-111111111111",
  "displayName": "King",
  "carModelKey": "slipstream",
  "color": "#f0a04b",
  "lat": 25.7907,
  "lon": -80.13,
  "headingDeg": 42,
  "speedMps": 12.4,
  "updatedAt": 1760812800000
}
```

Hooks: `publishGhost`, `pauseGhost`, `stopGhost`, `inviteGhost`, `acceptGhostInvite`, `declineGhostInvite`, `revokeGhostShare`, `listGhostInvites`, `listLiveGhosts`, `watchLiveGhosts`.

Apply `supabase/migrations/20261018000000_ghost_sharing.sql` on project `slide` before anyone can share.

## PlaceInfo

Copy + photos from Wikidata / Wikimedia Commons (by `brand:wikidata` or the brand table) plus OSM `website` / `opening_hours`. `/api/places` caches 24 h.

```ts
type PlacePhoto = { url: string; credit: string; source: "wikimedia" | "wikidata" | "osm" };

type PlaceInfo = {
  storeId: string;
  description?: string;
  photos: PlacePhoto[];
  openNow?: boolean;
  website?: string;
};
```

### Sample PlaceInfo

```json
{
  "storeId": "osm:node/123",
  "description": "American multinational retail corporation",
  "photos": [
    {
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Walmart_logo.svg?width=1280",
      "credit": "Wikimedia Commons · Walmart_logo.svg",
      "source": "wikidata"
    }
  ],
  "openNow": true,
  "website": "https://www.walmart.com"
}
```

Hook: `fetchPlaceInfo(store)` → `GET /api/places?storeId=&brandKey=&wikidata=&hours=&website=`.
