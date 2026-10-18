/**
 * Mirror of Nard's contract in docs/DATA_SHAPES.md (wishlist backend PR).
 * Any field can be missing — the look layer must empty-state, never crash.
 * Keep this file aligned when Nard's types land on main. Do not import from
 * `src/lib/stores`, `src/lib/place-info`, `src/lib/live-ghosts`, or
 * `src/lib/ghosts.ts` until that PR merges; swap fixtures for his hooks then.
 */

export const STORE_CATEGORIES = [
  "grocery",
  "pharmacy",
  "fuel",
  "fast_food",
  "coffee",
  "retail",
  "other",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export type Store = {
  id?: string;
  name?: string;
  brand?: string;
  /** Lowercase slug, e.g. `"walmart"`. */
  brandKey?: string;
  category?: StoreCategory;
  lat?: number;
  lon?: number;
  address?: string;
  hours?: string;
  phone?: string;
  website?: string;
  /** Brand color table, `#rrggbb`. */
  color?: string;
  logo?: string;
  /** `brandKey` when Leon has a model, else `"generic-"+category`. */
  modelKey?: string;
};

export type PlacePhoto = {
  url?: string;
  credit?: string;
  source?: "wikimedia" | "wikidata" | "osm";
};

export type PlaceInfo = {
  storeId?: string;
  description?: string;
  photos?: PlacePhoto[];
  openNow?: boolean;
  website?: string;
};

/**
 * Precise live ghost (not the ~1 km FriendSpot). Nard uses lat/lon; the
 * wishlist prompt also allowed a `position` pair — both are accepted.
 */
export type Ghost = {
  userId?: string;
  displayName?: string;
  carModelKey?: string;
  color?: string;
  lat?: number;
  lon?: number;
  position?: { lat?: number; lon?: number };
  headingDeg?: number;
  speedMps?: number;
  updatedAt?: number;
};

export function storeId(store: Store, fallback = "store"): string {
  return (store.id ?? "").trim() || fallback;
}

export function storeName(store: Store): string | undefined {
  const n = store.name?.trim();
  return n || undefined;
}

export function storeLngLat(store: Store): [number, number] | null {
  const lat = store.lat;
  const lon = store.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lon as number, lat as number];
}

export function ghostLngLat(ghost: Ghost): [number, number] | null {
  const lat = ghost.lat ?? ghost.position?.lat;
  const lon = ghost.lon ?? ghost.position?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lon as number, lat as number];
}

export function ghostName(ghost: Ghost): string | undefined {
  const n = ghost.displayName?.trim();
  return n || undefined;
}

export function modelKeyOf(store: Store): string {
  if (store.modelKey?.trim()) return store.modelKey.trim();
  if (store.brandKey?.trim()) return store.brandKey.trim();
  const cat = store.category ?? "other";
  return `generic-${cat}`;
}
