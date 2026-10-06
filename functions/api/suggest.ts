/**
 * GET /api/suggest?q=&lat=&lon=&limit=
 *
 * Autocomplete alias of /api/geocode?mode=suggest. Same TomTom-first chain,
 * same daily search budget. Client uses this while typing.
 */
import { onRequestGet as geocodeGet } from "./geocode";

type Ctx = { request: Request; env?: { TOMTOM_API_KEY?: string }; waitUntil?: (p: Promise<unknown>) => void };

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const url = new URL(ctx.request.url);
  if (!url.searchParams.get("mode")) url.searchParams.set("mode", "suggest");
  return geocodeGet({ ...ctx, request: new Request(url.toString(), ctx.request) });
}
