/**
 * GET /api/places?storeId=&brandKey=&wikidata=&hours=&website=
 *
 * Place copy + photos from Wikidata / Wikimedia Commons (CC / public brand
 * media) plus OSM hours/website already on the store. Cached 24 h. No key.
 */
import { loadPlaceInfo, PLACE_CACHE_TTL_SEC } from "../../src/lib/place-info";

type Ctx = { request: Request; waitUntil(p: Promise<unknown>): void };

const json = (body: unknown, maxAge = 60) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

export async function onRequestGet({ request, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId")?.trim();
  if (!storeId) return json({ error: "storeId required" }, 0);
  const cache = (caches as unknown as { default?: Cache }).default ?? null;
  const info = await loadPlaceInfo(
    {
      storeId,
      brandKey: url.searchParams.get("brandKey") ?? undefined,
      wikidata: url.searchParams.get("wikidata") ?? undefined,
      hours: url.searchParams.get("hours") ?? undefined,
      website: url.searchParams.get("website") ?? undefined,
    },
    { cache, waitUntil },
  );
  return json(info, PLACE_CACHE_TTL_SEC);
}
