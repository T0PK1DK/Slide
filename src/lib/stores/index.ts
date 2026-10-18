import { BRANDS } from "./brands";
import { capTiles, tilesForRoute } from "./overpass";
import type { BBox, Store } from "./types";

export type { Brand, BBox, Store, StoreCategory, StoreTile } from "./types";
export { BRANDS, KNOWN_STORE_MODELS, brandByKey, brandByName, brandByWikidata, brandLogoUrl, commonsFileUrl, slugify } from "./brands";
export { categoryFromOsm, storeFromOsm, storeModelKey, storesFromOverpass } from "./normalize";
export { openNow } from "./hours";
export {
  MAX_TILES_PER_REQUEST,
  OVERPASS_MIRRORS,
  STORE_CACHE_TTL_SEC,
  backoffMs,
  bboxFromCenter,
  capTiles,
  fetchOverpassJson,
  storeTile,
  storesOverpassQuery,
  tilesForBbox,
  tilesForRoute,
  withinKm,
} from "./overpass";

/** Grim / Leon: load major chains near a map centre. Empty if the Function is down. */
export async function loadStoresNear(lat: number, lon: number, km = 5): Promise<Store[]> {
  return loadStores(`/api/stores?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&km=${km}`);
}

/** Grim / Leon: load chains covering the current map view. */
export async function loadStoresInBbox(box: BBox): Promise<Store[]> {
  return loadStores(`/api/stores?bbox=${box.s.toFixed(3)},${box.w.toFixed(3)},${box.n.toFixed(3)},${box.e.toFixed(3)}`);
}

/** Grim / Leon: load chains along a planned line (tiled, not one huge bbox). */
export async function loadStoresAlongRoute(coords: Array<[number, number]>): Promise<Store[]> {
  const tiles = capTiles(tilesForRoute(coords));
  if (!tiles.length) return [];
  const keys = tiles.map((t) => t.key).join(",");
  return loadStores(`/api/stores?tiles=${encodeURIComponent(keys)}`);
}

async function loadStores(url: string): Promise<Store[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: Store[] };
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export const STORE_BRAND_COUNT = BRANDS.length;
