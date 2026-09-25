/**
 * GET /api/cameras?lat=&lon=&km= — enforcement cameras mapped in OpenStreetMap
 * (ODbL, © OpenStreetMap contributors), via the public Overpass API. Queried per
 * ~11 km tile and cached for a day at the edge, so the public Overpass server
 * sees a handful of requests no matter how many drivers there are.
 */
import { cameraTile, camerasFromOverpass, overpassQuery } from "../../src/lib/sources/osmcameras";
import { withinKm } from "../../src/lib/sources/fl511";

type Ctx = { request: Request; waitUntil(p: Promise<unknown>): void };

const OVERPASS = "https://overpass-api.de/api/interpreter";
const json = (body: unknown, maxAge = 3600) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` } });

export async function onRequestGet({ request, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const km = Math.min(Math.max(Number(url.searchParams.get("km")) || 5, 1), 10);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "lat and lon required" }, 0);

  const tile = cameraTile(lat, lon);
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://slide-cache.invalid/osm-cameras/${tile.key}`);
  let res = await cache.match(key);
  if (!res) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const up = await fetch(OVERPASS, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Slide/1 (kings-slide.pages.dev)" },
        body: `data=${encodeURIComponent(overpassQuery(tile.s, tile.w, tile.n, tile.e))}`,
        signal: ctrl.signal,
      });
      if (!up.ok) return json({ items: [], error: `Overpass ${up.status}` }, 60);
      res = new Response(JSON.stringify(camerasFromOverpass(await up.json())), { headers: { "cache-control": "public, max-age=86400" } });
      waitUntil(cache.put(key, res.clone()));
    } catch {
      return json({ items: [], error: "Overpass unreachable" }, 60);
    } finally {
      clearTimeout(t);
    }
  }
  const items = (await res.json()) as ReturnType<typeof camerasFromOverpass>;
  return json({ items: withinKm(items, lat, lon, km), source: "OpenStreetMap" });
}
