/**
 * GET /api/geocode?q=&lat=&lon=&mode=suggest|resolve&limit=
 *
 * Place search for the HUD. TomTom Fuzzy is first when TOMTOM_API_KEY is set
 * and the daily search budget still has room (~1,500). Miss, error, or a spent
 * cap falls through to Photon → Nominatim (≤1 req/s) → US Census.
 * Bias (`lat`/`lon`) ranks nearby hits; it never clips the result set.
 * The key never leaves this Function.
 */
import { handleGeocodeRequest } from "../../src/lib/geocode";
import {
  SEARCH_TTL_SEC,
  cacheBudgetStore,
  edgeCache,
  reserve,
} from "../../src/lib/tomtom-budget";

type Env = { TOMTOM_API_KEY?: string };
type Ctx = { request: Request; env?: Env; waitUntil?: (p: Promise<unknown>) => void };

const json = (body: unknown, maxAge = 15) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

async function allowSearch(waitUntil?: (p: Promise<unknown>) => void): Promise<boolean> {
  const cache = edgeCache();
  if (!cache || !waitUntil) return true;
  const reserved = await reserve(cacheBudgetStore(cache, waitUntil), "search");
  return reserved !== null;
}

export async function onRequestGet({ request, env, waitUntil }: Ctx): Promise<Response> {
  const key = env?.TOMTOM_API_KEY?.trim();
  const tomtom = Boolean(key) && (await allowSearch(waitUntil));
  const { hits, error, attribution } = await handleGeocodeRequest(request.url, {
    tomtomKey: tomtom ? key : undefined,
    tomtom,
  });
  const ttl = error ? 0 : hits.some((h) => h.source === "tomtom") ? SEARCH_TTL_SEC : 15;
  return json({ hits, ...(error ? { error } : {}), ...(attribution ? { attribution } : {}) }, ttl);
}
