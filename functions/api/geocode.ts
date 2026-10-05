/**
 * GET /api/geocode?q=&lat=&lon=&intent= — Nominatim + US Census fallback
 * after the client has tried Photon. Nominatim requires a named User-Agent
 * and at most 1 request per second; Census has no CORS, so both run here.
 */
import { fallbackPlaces, GEOCODE_UA, type SearchIntent } from "../../src/lib/geocode";

type Ctx = { request: Request; waitUntil(p: Promise<unknown>): void };

const json = (body: unknown, maxAge = 300) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

export async function onRequestGet({ request, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json({ hits: [] }, 0);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const intent: SearchIntent = url.searchParams.get("intent") === "resolve" ? "resolve" : "suggest";
  const bias = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined;

  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(
    `https://slide-cache.invalid/geocode/${intent}/${encodeURIComponent(q.toLowerCase())}/${(lat || 0).toFixed(2)}/${(lon || 0).toFixed(2)}`
  );
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const hits = await fallbackPlaces(q, bias, intent, { proxy: "", userAgent: GEOCODE_UA });
    const res = json({ hits }, hits.length ? 600 : 30);
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return json({ hits: [], error: e instanceof Error ? e.message : "geocode failed" }, 0);
  }
}
