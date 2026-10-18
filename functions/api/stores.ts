/**
 * GET /api/stores?lat=&lon=&km=
 * GET /api/stores?bbox=s,w,n,e
 * GET /api/stores?tiles=25.8_-80.2,...
 *
 * Major US chain stores from OpenStreetMap (ODbL) via public Overpass.
 * Tiled + edge-cached so Overpass sees a handful of calls. No key.
 */
import { loadStoresForRequest, parseStoresRequest } from "../../src/lib/stores/handler";
import { STORE_CACHE_TTL_SEC } from "../../src/lib/stores/overpass";

type Ctx = { request: Request; waitUntil(p: Promise<unknown>): void };

const json = (body: unknown, maxAge = 60) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

export async function onRequestGet({ request, waitUntil }: Ctx): Promise<Response> {
  const parsed = parseStoresRequest(request.url);
  if ("error" in parsed) return json({ error: parsed.error }, 0);

  const cache = (caches as unknown as { default?: Cache }).default ?? null;
  try {
    const { items, error } = await loadStoresForRequest(parsed, { cache, waitUntil });
    if (error && !items.length) return json({ items: [], error, source: "OpenStreetMap" }, 60);
    return json({ items, source: "OpenStreetMap", ...(error ? { error } : {}) }, STORE_CACHE_TTL_SEC);
  } catch {
    return json({ items: [], error: "Overpass unreachable", source: "OpenStreetMap" }, 60);
  }
}
