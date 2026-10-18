import { storesFromOverpass, type OsmElement } from "./normalize";
import {
  MAX_TILES_PER_REQUEST,
  STORE_CACHE_TTL_SEC,
  bboxFromCenter,
  capTiles,
  fetchOverpassJson,
  storeTile,
  storesOverpassQuery,
  tilesForBbox,
  withinKm,
  type OverpassFetch,
  type Sleep,
} from "./overpass";
import type { Store, StoreTile } from "./types";

export type StoreCache = {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
};

export type StoresRequest = {
  lat?: number;
  lon?: number;
  km?: number;
  bbox?: { s: number; w: number; n: number; e: number };
  tileKeys?: string[];
};

export function parseStoresRequest(url: string): StoresRequest | { error: string } {
  const u = new URL(url, "https://slide.invalid");
  const tiles = u.searchParams.get("tiles");
  if (tiles) {
    const tileKeys = tiles.split(",").map((k) => k.trim()).filter(Boolean);
    if (!tileKeys.length) return { error: "tiles required" };
    return { tileKeys };
  }
  const bboxRaw = u.searchParams.get("bbox");
  if (bboxRaw) {
    const p = bboxRaw.split(",").map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return { error: "bbox=s,w,n,e" };
    return { bbox: { s: p[0], w: p[1], n: p[2], e: p[3] } };
  }
  const latRaw = u.searchParams.get("lat");
  const lonRaw = u.searchParams.get("lon");
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  const km = Math.min(Math.max(Number(u.searchParams.get("km")) || 5, 1), 15);
  if (latRaw === null || lonRaw === null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: "lat and lon required" };
  }
  return { lat, lon, km };
}

export function tilesForRequest(req: StoresRequest): StoreTile[] {
  if (req.tileKeys?.length) {
    return capTiles(req.tileKeys.map(tileFromKey).filter((t): t is StoreTile => Boolean(t)));
  }
  if (req.bbox) return capTiles(tilesForBbox(req.bbox));
  if (typeof req.lat === "number" && typeof req.lon === "number") {
    return capTiles(tilesForBbox(bboxFromCenter(req.lat, req.lon, req.km ?? 5)));
  }
  return [];
}

function tileFromKey(key: string): StoreTile | null {
  const m = /^(-?\d+\.\d)_(-?\d+\.\d)$/.exec(key);
  if (!m) return null;
  const s = Number(m[1]);
  const w = Number(m[2]);
  if (!Number.isFinite(s) || !Number.isFinite(w)) return null;
  return storeTile(s + 0.001, w + 0.001);
}

function cacheKey(tile: StoreTile): Request {
  return new Request(`https://slide-cache.invalid/osm-stores/${tile.key}`);
}

export async function loadStoresForRequest(
  req: StoresRequest,
  opts: {
    cache?: StoreCache | null;
    fetch?: OverpassFetch;
    sleep?: Sleep;
    waitUntil?: (p: Promise<unknown>) => void;
    ttlSec?: number;
  } = {},
): Promise<{ items: Store[]; error?: string }> {
  const tiles = tilesForRequest(req);
  if (!tiles.length) return { items: [], error: "no tiles" };
  const ttl = opts.ttlSec ?? STORE_CACHE_TTL_SEC;
  const collected: Store[] = [];
  const seen = new Set<string>();
  let error: string | undefined;
  for (const tile of tiles) {
    try {
      const batch = await loadTile(tile, opts, ttl);
      for (const s of batch) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        collected.push(s);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Overpass unreachable";
    }
  }
  let items = collected;
  if (typeof req.lat === "number" && typeof req.lon === "number") {
    items = withinKm(items, req.lat, req.lon, req.km ?? 5);
  }
  return error && !items.length ? { items: [], error } : { items, ...(error ? { error } : {}) };
}

async function loadTile(
  tile: StoreTile,
  opts: {
    cache?: StoreCache | null;
    fetch?: OverpassFetch;
    sleep?: Sleep;
    waitUntil?: (p: Promise<unknown>) => void;
  },
  ttl: number,
): Promise<Store[]> {
  const key = cacheKey(tile);
  const hit = opts.cache ? await opts.cache.match(key) : undefined;
  if (hit) {
    try {
      const json = (await hit.json()) as Store[];
      if (Array.isArray(json)) return json;
    } catch {
      /* rebuild */
    }
  }
  const json = await fetchOverpassJson(storesOverpassQuery(tile), { fetch: opts.fetch, sleep: opts.sleep });
  const items = storesFromOverpass(json as { elements?: OsmElement[] });
  if (opts.cache) {
    const res = new Response(JSON.stringify(items), { headers: { "cache-control": `public, max-age=${ttl}` } });
    const put = opts.cache.put(key, res);
    if (opts.waitUntil) opts.waitUntil(put);
    else await put;
  }
  return items;
}

export const MAX_STORE_TILES = MAX_TILES_PER_REQUEST;
