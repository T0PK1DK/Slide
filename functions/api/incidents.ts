/**
 * GET /api/incidents?lat=&lon=&km= — official Florida 511 events near a point.
 * Cloudflare Pages Function: the FL511 key lives in the Pages secret
 * FL511_API_KEY and never reaches the browser. One upstream call per ~60 s is
 * shared by every driver (edge cache), which keeps us far inside FL511's limits.
 * Without the key it answers `{ items: [], configured: false }` so the app just
 * shows driver reports.
 */
import { fromFl511, withinKm } from "../../src/lib/sources/fl511";

type Env = { FL511_API_KEY?: string };
type Ctx = { request: Request; env: Env; waitUntil(p: Promise<unknown>): void };

const FEED = "https://fl511.com/api/v2/get/event";
const json = (body: unknown, maxAge = 30) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

export async function onRequestGet({ request, env, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const km = Math.min(Math.max(Number(url.searchParams.get("km")) || 12, 1), 50);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "lat and lon required" }, 0);
  if (!env.FL511_API_KEY) return json({ items: [], configured: false }, 300);

  // One shared upstream fetch per minute for the whole state feed.
  const cacheKey = new Request("https://slide-cache.invalid/fl511/events");
  const cache = (caches as unknown as { default: Cache }).default;
  let feed = await cache.match(cacheKey);
  if (!feed) {
    const upstream = await fetch(`${FEED}?key=${encodeURIComponent(env.FL511_API_KEY)}&format=json`, {
      headers: { accept: "application/json" },
    });
    if (!upstream.ok) return json({ items: [], configured: true, error: `FL511 ${upstream.status}` }, 15);
    feed = new Response(await upstream.text(), { headers: { "cache-control": "public, max-age=60" } });
    waitUntil(cache.put(cacheKey, feed.clone()));
  }
  let events: unknown;
  try {
    events = await feed.json();
  } catch {
    return json({ items: [], configured: true, error: "FL511 sent non-JSON" }, 15);
  }
  const list = Array.isArray(events) ? events : [];
  const items = list.map((e) => fromFl511(e as Record<string, unknown>)).filter((x): x is NonNullable<typeof x> => x !== null);
  return json({ items: withinKm(items, lat, lon, km).slice(0, 150), configured: true });
}
