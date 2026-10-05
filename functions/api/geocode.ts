/**
 * GET /api/geocode?q=&lat=&lon=&mode=suggest|resolve&limit=
 *
 * Place search for the HUD. The browser cannot send Nominatim's required
 * User-Agent, so the Worker does Photon → Nominatim (≤1 req/s) → US Census.
 * Bias (`lat`/`lon`) ranks nearby hits; it never clips the result set.
 */
import { handleGeocodeRequest } from "../../src/lib/geocode";

type Ctx = { request: Request };

const json = (body: unknown, maxAge = 15) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

export async function onRequestGet({ request }: Ctx): Promise<Response> {
  const { hits, error } = await handleGeocodeRequest(request.url);
  return json({ hits, ...(error ? { error } : {}) }, error ? 0 : 15);
}
