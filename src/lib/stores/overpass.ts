import { brandNameRegex, wikidataRegex } from "./brands";
import { storesFromOverpass } from "./normalize";
import type { BBox, Store, StoreTile } from "./types";

export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
] as const;

export const STORE_TILE_DEG = 0.1;
export const STORE_CACHE_TTL_SEC = 3600;
export const STORE_USER_AGENT = "Slide/1 (kings-slide.pages.dev)";
export const MAX_TILES_PER_REQUEST = 12;

/** ~11 km tile, same grid as enforcement cameras so nearby drivers share a cache. */
export function storeTile(lat: number, lon: number): StoreTile {
  const s = Math.floor(lat * 10) / 10;
  const w = Math.floor(lon * 10) / 10;
  return { s, w, n: s + STORE_TILE_DEG, e: w + STORE_TILE_DEG, key: `${s.toFixed(1)}_${w.toFixed(1)}` };
}

export function tilesForBbox(box: BBox): StoreTile[] {
  const s0 = Math.floor(box.s * 10) / 10;
  const w0 = Math.floor(box.w * 10) / 10;
  const nMax = Math.ceil(box.n * 10) / 10;
  const eMax = Math.ceil(box.e * 10) / 10;
  const out: StoreTile[] = [];
  const seen = new Set<string>();
  for (let s = s0; s < nMax - 1e-9; s = Math.round((s + STORE_TILE_DEG) * 10) / 10) {
    for (let w = w0; w < eMax - 1e-9; w = Math.round((w + STORE_TILE_DEG) * 10) / 10) {
      const t = storeTile(s + 0.001, w + 0.001);
      if (seen.has(t.key)) continue;
      seen.add(t.key);
      out.push(t);
    }
  }
  return out;
}

/** Sample the line so a long Miami trip still tiles instead of one huge bbox. */
export function tilesForRoute(coords: Array<[number, number]>, stepDeg = 0.08): StoreTile[] {
  const seen = new Set<string>();
  const out: StoreTile[] = [];
  let last: [number, number] | null = null;
  for (const c of coords) {
    if (!last || Math.hypot(c[0] - last[0], c[1] - last[1]) >= stepDeg) {
      const t = storeTile(c[1], c[0]);
      if (!seen.has(t.key)) {
        seen.add(t.key);
        out.push(t);
      }
      last = c;
    }
  }
  return out;
}

export function bboxFromCenter(lat: number, lon: number, km: number): BBox {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, w: lon - dLon, n: lat + dLat, e: lon + dLon };
}

export function withinKm(stores: Store[], lat: number, lon: number, km: number): Store[] {
  const box = bboxFromCenter(lat, lon, km);
  return stores.filter((s) => s.lat >= box.s && s.lat <= box.n && s.lon >= box.w && s.lon <= box.e);
}

/**
 * Major chains only: `brand:wikidata` (NSI) or a known `brand` name.
 * Ways/relations come back with `out center` so they still have a pin.
 */
export function storesOverpassQuery(tile: BBox): string {
  const bbox = `${tile.s.toFixed(3)},${tile.w.toFixed(3)},${tile.n.toFixed(3)},${tile.e.toFixed(3)}`;
  const wiki = wikidataRegex();
  const names = brandNameRegex();
  return `[out:json][timeout:25];
(
  nwr["brand:wikidata"~"${wiki}"](${bbox});
  nwr["operator:wikidata"~"${wiki}"](${bbox});
  nwr["brand"~"${names}",i](${bbox});
);
out center tags;`;
}

export function backoffMs(attempt: number, status?: number, retryAfterSec?: number): number {
  if (retryAfterSec && retryAfterSec > 0) return Math.min(30_000, retryAfterSec * 1000);
  const base = status === 429 || status === 504 || status === 503 ? 800 : 400;
  return Math.min(8_000, base * 2 ** attempt);
}

export type Sleep = (ms: number) => Promise<void>;

export type OverpassFetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * POST the query to public Overpass mirrors. 429 / 5xx / timeout → backoff and
 * the next mirror. Never invents stores when every attempt fails.
 */
export async function fetchOverpassJson(
  query: string,
  opts: { fetch?: OverpassFetch; sleep?: Sleep; mirrors?: readonly string[]; attempts?: number; signal?: AbortSignal } = {},
): Promise<{ elements?: unknown[] }> {
  const fetchFn = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const mirrors = opts.mirrors ?? OVERPASS_MIRRORS;
  const attempts = opts.attempts ?? 3;
  let lastErr = "Overpass unreachable";
  for (let i = 0; i < attempts; i++) {
    const url = mirrors[i % mirrors.length];
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": STORE_USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: opts.signal,
      });
      if (res.status === 429 || res.status === 503 || res.status === 504 || res.status >= 500) {
        lastErr = `Overpass ${res.status}`;
        const retry = Number(res.headers.get("retry-after"));
        await sleep(backoffMs(i, res.status, Number.isFinite(retry) ? retry : undefined));
        continue;
      }
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      return (await res.json()) as { elements?: unknown[] };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Overpass unreachable";
      if (i < attempts - 1) await sleep(backoffMs(i));
    }
  }
  throw new Error(lastErr);
}

export async function storesForTile(
  tile: StoreTile,
  opts: { fetch?: OverpassFetch; sleep?: Sleep; signal?: AbortSignal } = {},
): Promise<Store[]> {
  const json = await fetchOverpassJson(storesOverpassQuery(tile), opts);
  return storesFromOverpass(json as { elements?: import("./normalize").OsmElement[] });
}

export function capTiles(tiles: StoreTile[], max = MAX_TILES_PER_REQUEST): StoreTile[] {
  return tiles.slice(0, max);
}
