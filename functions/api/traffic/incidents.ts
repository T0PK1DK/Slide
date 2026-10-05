/**
 * GET /api/traffic/incidents?lat=&lon=&km= — TomTom Incident Details, proxied
 * so TOMTOM_API_KEY never ships to the browser. Empty list (not fake items)
 * when the secret is missing.
 */
import { bboxAround, fromTomTomIncident, incidentDetailsUrl } from "../../../src/lib/sources/tomtom";
import { withinKm } from "../../../src/lib/sources/fl511";
import { cachedJson, json } from "../../lib/cache";

type Env = { TOMTOM_API_KEY?: string };
type Ctx = { request: Request; env: Env; waitUntil(p: Promise<unknown>): void };

const notNull = <T,>(x: T | null): x is T => x !== null;

export async function onRequestGet({ request, env, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const km = Math.min(Math.max(Number(url.searchParams.get("km")) || 12, 1), 40);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "lat and lon required" }, 0);

  if (!env.TOMTOM_API_KEY) return json({ configured: false, items: [] }, 30);

  const box = bboxAround(lat, lon, km);
  const tile = `${lat.toFixed(2)},${lon.toFixed(2)},${km}`;
  try {
    const d = (await cachedJson(
      `tomtom-incidents/${tile}`,
      incidentDetailsUrl(box, env.TOMTOM_API_KEY),
      waitUntil,
      60,
    )) as { incidents?: unknown[]; error?: { description?: string } };
    if (d.error) throw new Error(d.error.description ?? "TomTom error");
    const items = (Array.isArray(d.incidents) ? d.incidents : [])
      .map((f) => fromTomTomIncident(f as { geometry?: unknown; properties?: Record<string, unknown> }))
      .filter(notNull);
    return json({ configured: true, items: withinKm(items, lat, lon, km).slice(0, 80) }, 30);
  } catch (e) {
    return json({ configured: true, items: [], error: e instanceof Error ? e.message : "failed" }, 15);
  }
}
