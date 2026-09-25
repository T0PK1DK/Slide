/**
 * GET /api/transit?lat=&lon=&km= — live buses and trains near a point, from the
 * GTFS-realtime VehiclePositions feeds listed in the TRANSIT_FEEDS secret (see
 * src/lib/sources/transit.ts). Each feed is fetched at most every ~20 s and
 * shared by every driver through the edge cache. No feeds configured → empty.
 */
import { decodeVehiclePositions } from "../../src/lib/sources/gtfsrt";
import { withinKm } from "../../src/lib/sources/fl511";
import { parseFeeds, vehiclesToItems, type TransitFeed } from "../../src/lib/sources/transit";

type Env = { TRANSIT_FEEDS?: string };
type Ctx = { request: Request; env: Env; waitUntil(p: Promise<unknown>): void };

const json = (body: unknown, maxAge = 10) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` } });

async function feedBytes(feed: TransitFeed, waitUntil: Ctx["waitUntil"]): Promise<Uint8Array | null> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://slide-cache.invalid/gtfsrt/${encodeURIComponent(feed.url)}`);
  let res = await cache.match(key);
  if (!res) {
    const headers: Record<string, string> = { accept: "application/x-protobuf, application/octet-stream" };
    if (feed.header && feed.key) headers[feed.header] = feed.key;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const up = await fetch(feed.url, { headers, signal: ctrl.signal });
      if (!up.ok) return null;
      res = new Response(await up.arrayBuffer(), { headers: { "cache-control": "public, max-age=20" } });
      waitUntil(cache.put(key, res.clone()));
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function onRequestGet({ request, env, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const km = Math.min(Math.max(Number(url.searchParams.get("km")) || 4, 1), 20);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "lat and lon required" }, 0);
  const feeds = parseFeeds(env.TRANSIT_FEEDS);
  if (!feeds.length) return json({ items: [], configured: false }, 300);
  const results = await Promise.all(feeds.map(async (feed) => {
    const bytes = await feedBytes(feed, waitUntil);
    if (!bytes) return { agency: feed.agency, ok: false, items: [] };
    try {
      return { agency: feed.agency, ok: true, items: withinKm(vehiclesToItems(decodeVehiclePositions(bytes), feed), lat, lon, km) };
    } catch {
      return { agency: feed.agency, ok: false, items: [] };
    }
  }));
  return json({
    configured: true,
    agencies: results.map((r) => ({ agency: r.agency, ok: r.ok })),
    items: results.flatMap((r) => r.items).slice(0, 200),
  });
}
