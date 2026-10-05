/**
 * GET /api/traffic/route?pts=lon,lat|lon,lat|… — Flow Segment Data for a
 * handful of points along a line. Cached per rounded point so a personal
 * app stays inside TomTom's free tier. No key → configured:false, no samples.
 */
import { fromFlowSegment, flowSegmentUrl, sampleRoutePoints } from "../../../src/lib/sources/tomtom";
import { cachedJson, json } from "../../lib/cache";

type Env = { TOMTOM_API_KEY?: string };
type Ctx = { request: Request; env: Env; waitUntil(p: Promise<unknown>): void };

export async function onRequestGet({ request, env, waitUntil }: Ctx): Promise<Response> {
  if (!env.TOMTOM_API_KEY) return json({ configured: false, samples: [] }, 30);

  const url = new URL(request.url);
  const raw = url.searchParams.get("pts") ?? "";
  const coords: Array<[number, number]> = [];
  for (const part of raw.split("|")) {
    const [lonS, latS] = part.split(",");
    const lon = Number(lonS);
    const lat = Number(latS);
    if (Number.isFinite(lon) && Number.isFinite(lat)) coords.push([lon, lat]);
  }
  const pts = sampleRoutePoints(coords, 1800, 10);
  if (!pts.length) return json({ configured: true, samples: [] }, 15);

  const samples = [];
  for (const [lon, lat] of pts) {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    try {
      const d = await cachedJson(
        `tomtom-flow/${key}`,
        flowSegmentUrl(lat, lon, env.TOMTOM_API_KEY),
        waitUntil,
        90,
      );
      const s = fromFlowSegment(d, { lon, lat });
      if (s) samples.push(s);
    } catch {
      // One point failing must not invent a speed or drop the rest.
    }
  }
  return json({ configured: true, samples }, 20);
}
