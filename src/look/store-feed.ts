import { fetchPlaceInfo, type PlaceInfo } from "../lib/place-info";
import { capTiles, storeTile, tilesForBbox, type BBox, type Store } from "../lib/stores";
import { haversineMeters } from "../lib/polyline";

/** Skip Overpass when the view is the whole metro — pins wouldn't read anyway. */
export const MIN_STORE_ZOOM = 12;
export const MOVE_DEBOUNCE_MS = 600;
export const CLIENT_TILE_TTL_MS = 8 * 60_000;
export const CLIENT_PLACE_TTL_MS = 30 * 60_000;

export const LOOK_LIVE = {
  loading: "Looking for stores…",
  empty: "No stores in view",
  error: "Stores didn’t load · tap to retry",
  zoom: "Zoom in for stores",
} as const;

export type StoreFeedSnapshot = {
  stores: Store[];
  error?: string;
  fromCache: boolean;
  aborted?: boolean;
};

export type FetchStoresFn = (
  url: string,
  signal?: AbortSignal,
) => Promise<{ items: Store[]; error?: string; aborted?: boolean }>;

export function shouldLoadStores(zoom: number): boolean {
  return zoom >= MIN_STORE_ZOOM;
}

export function mapBbox(bounds: { getSouth(): number; getWest(): number; getNorth(): number; getEast(): number }): BBox {
  return { s: bounds.getSouth(), w: bounds.getWest(), n: bounds.getNorth(), e: bounds.getEast() };
}

export function debounce(ms: number): (fn: () => void) => void {
  let t = 0;
  return (fn) => {
    clearTimeout(t);
    t = setTimeout(fn, ms) as unknown as number;
  };
}

export type LookStatusKind = "zoom" | "loading" | "error" | "empty" | null;

/** Copy for the HUD pill. Hidden (`kind: null`) once pins are on the map. */
export function lookStatusFor(opts: {
  zoom: number;
  loading: boolean;
  error?: string;
  count: number;
}): { kind: LookStatusKind; text: string } {
  if (!shouldLoadStores(opts.zoom)) return { kind: "zoom", text: LOOK_LIVE.zoom };
  if (opts.loading && opts.count === 0) return { kind: "loading", text: LOOK_LIVE.loading };
  if (opts.error && opts.count === 0) return { kind: "error", text: opts.error };
  if (!opts.loading && opts.count === 0) return { kind: "empty", text: LOOK_LIVE.empty };
  return { kind: null, text: "" };
}

export async function defaultFetchStores(
  url: string,
  signal?: AbortSignal,
): Promise<{ items: Store[]; error?: string; aborted?: boolean }> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      return { items: [], error: res.status === 429 ? "Stores are busy · tap to retry" : LOOK_LIVE.error };
    }
    const json = (await res.json()) as { items?: Store[]; error?: string };
    return {
      items: Array.isArray(json.items) ? json.items : [],
      error: json.error,
    };
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return { items: [], aborted: true };
    return { items: [], error: LOOK_LIVE.error };
  }
}

export function storesInBbox(stores: Store[], box: BBox): Store[] {
  return stores.filter((s) => s.lat >= box.s && s.lat <= box.n && s.lon >= box.w && s.lon <= box.e);
}

export function nearestStore(stores: Store[], lat: number, lon: number, maxM = 90): Store | undefined {
  let best: Store | undefined;
  let bestM = maxM;
  for (const s of stores) {
    const m = haversineMeters(lon, lat, s.lon, s.lat);
    if (m < bestM) {
      best = s;
      bestM = m;
    }
  }
  return best;
}

export function createStoreFeed(opts?: {
  fetchStores?: FetchStoresFn;
  fetchPlace?: typeof fetchPlaceInfo;
  now?: () => number;
}) {
  const fetchStores = opts?.fetchStores ?? defaultFetchStores;
  const fetchPlace = opts?.fetchPlace ?? fetchPlaceInfo;
  const now = opts?.now ?? Date.now;
  const tileAt = new Map<string, number>();
  const byId = new Map<string, Store>();
  const places = new Map<string, { at: number; info: PlaceInfo }>();
  let inflight: AbortController | null = null;

  const fresh = (key: string) => {
    const at = tileAt.get(key);
    return at !== undefined && now() - at < CLIENT_TILE_TTL_MS;
  };

  return {
    peek(): Store[] {
      return [...byId.values()];
    },
    async loadBbox(box: BBox): Promise<StoreFeedSnapshot> {
      const tiles = capTiles(tilesForBbox(box));
      if (!tiles.length) return { stores: [], fromCache: true };
      const missing = tiles.filter((t) => !fresh(t.key));
      const cached = storesInBbox([...byId.values()], box);
      if (!missing.length) return { stores: cached, fromCache: true };

      inflight?.abort();
      inflight = new AbortController();
      const url = `/api/stores?tiles=${encodeURIComponent(missing.map((t) => t.key).join(","))}`;
      const { items, error, aborted } = await fetchStores(url, inflight.signal);
      if (aborted) return { stores: cached, fromCache: true, aborted: true };

      for (const s of items) {
        if (s?.id) byId.set(s.id, s);
      }
      if (!error) {
        const at = now();
        for (const t of missing) tileAt.set(t.key, at);
      }
      return {
        stores: storesInBbox([...byId.values()], box),
        fromCache: false,
        error: error && !items.length ? error : undefined,
      };
    },
    async loadPlace(store: Pick<Store, "id" | "brandKey" | "hours" | "website">): Promise<PlaceInfo> {
      const hit = places.get(store.id);
      if (hit && now() - hit.at < CLIENT_PLACE_TTL_MS) return hit.info;
      const info = await fetchPlace(store);
      places.set(store.id, { at: now(), info });
      return info;
    },
    rememberTile(lat: number, lon: number, store: Store) {
      byId.set(store.id, store);
      tileAt.set(storeTile(lat, lon).key, now());
    },
  };
}

export type StoreFeed = ReturnType<typeof createStoreFeed>;
