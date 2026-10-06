/**
 * GET/POST /api/traffic/* — TomTom Traffic + Routing proxy.
 * The key is the Pages secret TOMTOM_API_KEY (never a VITE_ var).
 *
 *   /api/traffic/status              { configured, budget }
 *   /api/traffic/flow/:z/:x/:y       relative vector flow tile (PBF)
 *   /api/traffic/incidents?bbox=     Incident Details → radar items
 *   /api/traffic/along?points=       Flow Segment Data for sampled points
 *   /api/traffic/route               Routing traffic=true + speedLimit sections
 *                                   GET ?points=lat,lon|…  or POST { points }
 *
 * Missing key: status says configured:false, tiles 204, lists empty.
 * Never invents flow, incidents, or ETAs. Search/incident cache is minutes;
 * routing is ~15 s (TomTom terms: honor Cache-Control, no result database).
 * Leon may extend /route — keep the JSON shape stable.
 */
import { fromTomTom, TOMTOM_FLOW_SEGMENT, TOMTOM_FLOW_TILE, TOMTOM_INCIDENTS, TOMTOM_ROUTE } from "../../../src/lib/sources/tomtom";
import { trafficRouteOf, supportingPointsOf, type RoutePoint } from "../../../src/lib/tomtom-route";
import {
  INCIDENT_TTL_SEC,
  ROUTE_TTL_SEC,
  TOMTOM_ATTRIBUTION,
  cacheBudgetStore,
  edgeCache,
  emptyBudget,
  remaining,
  reserve,
  utcDay,
  type TomTomBudget,
  type TomTomSpend,
} from "../../../src/lib/tomtom-budget";
import type { RadarItem } from "../../../src/lib/reports";

type Env = { TOMTOM_API_KEY?: string };
type Ctx = { request: Request; env: Env; waitUntil(p: Promise<unknown>): void; params?: { path?: string | string[] } };

const UA = "Slide/1 (+https://kings-slide.pages.dev)";
const TTL = 120;
const json = (body: unknown, maxAge = 30, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

function rest(request: Request, params?: { path?: string | string[] }): string[] {
  if (params?.path) return (Array.isArray(params.path) ? params.path : params.path.split("/")).filter(Boolean);
  const url = new URL(request.url);
  return url.pathname.replace(/^\/api\/traffic\/?/, "").split("/").filter(Boolean);
}

async function cached(name: string, url: string, waitUntil: Ctx["waitUntil"], ttl = TTL, timeoutMs = 7000): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://slide-cache.invalid/traffic/${name}`);
  let res = await cache.match(key);
  if (res) return res;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const up = await fetch(url, { headers: { accept: "*/*", "user-agent": UA }, signal: ctrl.signal });
    if (!up.ok) throw new Error(`HTTP ${up.status}`);
    const buf = await up.arrayBuffer();
    res = new Response(buf, {
      headers: {
        "content-type": up.headers.get("content-type") || "application/octet-stream",
        "cache-control": `public, max-age=${ttl}`,
      },
    });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function cachedJson(name: string, url: string, waitUntil: Ctx["waitUntil"], ttl = TTL, timeoutMs = 7000): Promise<unknown> {
  const res = await cached(name, url, waitUntil, ttl, timeoutMs);
  return res.json();
}

function parseBbox(raw: string | null): string | null {
  if (!raw) return null;
  const n = raw.split(",").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return null;
  const [minLon, minLat, maxLon, maxLat] = n;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  if (Math.abs(maxLon - minLon) > 2.5 || Math.abs(maxLat - minLat) > 2.5) return null;
  return `${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}`;
}

function parsePoints(raw: string | null): Array<{ lat: number; lon: number }> {
  if (!raw) return [];
  const out: Array<{ lat: number; lon: number }> = [];
  for (const part of raw.split("|")) {
    const [lat, lon] = part.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push({ lat, lon });
    if (out.length >= 10) break;
  }
  return out;
}

async function readBudget(waitUntil: Ctx["waitUntil"]): Promise<TomTomBudget> {
  const cache = edgeCache();
  if (!cache) return emptyBudget(utcDay());
  return (await cacheBudgetStore(cache, waitUntil).get()) ?? emptyBudget(utcDay());
}

async function spendIfAble(kind: TomTomSpend, waitUntil: Ctx["waitUntil"]): Promise<boolean> {
  const cache = edgeCache();
  if (!cache) return true;
  return (await reserve(cacheBudgetStore(cache, waitUntil), kind)) !== null;
}

export async function onRequestGet({ request, env, waitUntil, params }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const parts = rest(request, params);
  const key = env.TOMTOM_API_KEY?.trim();

  if (parts[0] === "status" || parts.length === 0) {
    const b = await readBudget(waitUntil);
    const left = remaining(b.day === utcDay() ? b : emptyBudget(utcDay()));
    return json({ configured: Boolean(key), attribution: TOMTOM_ATTRIBUTION, budget: { ...left, used: b } }, 15);
  }

  if (!key) {
    if (parts[0] === "flow") return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=60" } });
    if (parts[0] === "route") return json({ configured: false, travelTimeSec: null, trafficDelaySec: null, speedLimits: [] }, 60);
    return json({ configured: false, items: [], samples: [] }, 60);
  }

  try {
    if (parts[0] === "flow" && parts.length >= 4) {
      const z = Number(parts[1]), x = Number(parts[2]), y = Number(parts[3].replace(/\.(pbf|png)$/, ""));
      if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) return json({ error: "bad tile" }, 0, 400);
      if (z < 8 || z > 16) return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=300" } });
      const tile = await cached(`flow-${z}-${x}-${y}`, TOMTOM_FLOW_TILE(z, x, y, key), waitUntil, TTL, 8000);
      return new Response(tile.body, {
        headers: {
          "content-type": "application/vnd.mapbox-vector-tile",
          "cache-control": `public, max-age=${TTL}`,
        },
      });
    }

    if (parts[0] === "incidents") {
      const bbox = parseBbox(url.searchParams.get("bbox"));
      if (!bbox) return json({ error: "bbox=minLon,minLat,maxLon,maxLat required" }, 0, 400);
      if (!(await spendIfAble("incidents", waitUntil))) return json({ configured: true, items: [], error: "budget" }, 15);
      const d = (await cachedJson(`inc-${bbox}`, TOMTOM_INCIDENTS(bbox, key), waitUntil, INCIDENT_TTL_SEC)) as { incidents?: unknown[] };
      const items = (d.incidents ?? [])
        .map((e) => fromTomTom(e as Parameters<typeof fromTomTom>[0]))
        .filter((x): x is RadarItem => x !== null)
        .slice(0, 80);
      return json({ configured: true, items }, 30);
    }

    if (parts[0] === "along") {
      const pts = parsePoints(url.searchParams.get("points"));
      if (!pts.length) return json({ error: "points=lat,lon|… required" }, 0, 400);
      const cacheName = `along-${pts.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join("_")}`;
      const cache = (caches as unknown as { default: Cache }).default;
      const ck = new Request(`https://slide-cache.invalid/traffic/${cacheName}`);
      const hit = await cache.match(ck);
      if (hit) return hit;
      if (!(await spendIfAble("other", waitUntil))) return json({ configured: true, samples: [], error: "budget" }, 15);
      const samples = await Promise.all(pts.map(async (p) => {
        try {
          const d = (await cachedJson(
            `seg-${p.lat.toFixed(3)}-${p.lon.toFixed(3)}`,
            TOMTOM_FLOW_SEGMENT(p.lat, p.lon, key),
            waitUntil,
            TTL,
            6000,
          )) as { flowSegmentData?: { currentSpeed?: number; freeFlowSpeed?: number; currentTravelTime?: number; freeFlowTravelTime?: number; confidence?: number; roadClosure?: boolean } };
          const s = d.flowSegmentData;
          if (!s) return null;
          return {
            lon: p.lon,
            lat: p.lat,
            currentSpeed: s.currentSpeed,
            freeFlowSpeed: s.freeFlowSpeed,
            currentTravelTime: s.currentTravelTime,
            freeFlowTravelTime: s.freeFlowTravelTime,
            confidence: s.confidence,
            roadClosure: s.roadClosure === true,
          };
        } catch {
          return null;
        }
      }));
      const body = json({ configured: true, samples: samples.filter(Boolean) }, 30);
      waitUntil(cache.put(ck, body.clone()));
      return body;
    }

    if (parts[0] === "route") {
      return routeResponse(url.searchParams.get("points"), null, key, waitUntil);
    }
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timeout" : e instanceof Error ? e.message : "failed";
    return json({ configured: true, error: msg, items: [], samples: [] }, 15, 502);
  }

  return json({ error: "unknown traffic path" }, 0, 404);
}

async function routeResponse(
  pointsRaw: string | null,
  bodyPoints: RoutePoint[] | null,
  key: string,
  waitUntil: Ctx["waitUntil"],
): Promise<Response> {
  const pts = bodyPoints?.length ? bodyPoints.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).slice(0, 40) : parsePoints(pointsRaw);
  if (pts.length < 2) return json({ error: "points=lat,lon|lat,lon required" }, 0, 400);
  const origin = pts[0];
  const dest = pts[pts.length - 1];
  const support = supportingPointsOf(pts);
  const url = TOMTOM_ROUTE(origin, dest, key);
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheName = `route-${pts.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join("_")}`;
  const ck = new Request(`https://slide-cache.invalid/traffic/${cacheName}`);
  const hit = await cache.match(ck);
  if (hit) return hit;
  if (!(await spendIfAble("route", waitUntil))) {
    return json({ configured: true, error: "budget", travelTimeSec: null, trafficDelaySec: null, speedLimits: [] }, 5);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const up = await fetch(url, {
      method: support.length ? "POST" : "GET",
      headers: {
        accept: "application/json",
        "user-agent": UA,
        ...(support.length ? { "content-type": "application/json" } : {}),
      },
      body: support.length ? JSON.stringify({ supportingPoints: support.map((p) => ({ latitude: p.lat, longitude: p.lon })) }) : undefined,
      signal: ctrl.signal,
    });
    if (!up.ok) throw new Error(`HTTP ${up.status}`);
    const parsed = trafficRouteOf(await up.json());
    if (!parsed) return json({ configured: true, error: "no route", travelTimeSec: null, trafficDelaySec: null, speedLimits: [] }, 5);
    const body = json(
      {
        configured: true,
        travelTimeSec: parsed.travelTimeSec,
        trafficDelaySec: parsed.trafficDelaySec,
        noTrafficSec: parsed.noTrafficSec,
        lengthMeters: parsed.lengthMeters,
        speedLimits: parsed.speedLimits,
        attribution: TOMTOM_ATTRIBUTION,
      },
      ROUTE_TTL_SEC,
    );
    waitUntil(cache.put(ck, body.clone()));
    return body;
  } finally {
    clearTimeout(t);
  }
}

export async function onRequestPost({ request, env, waitUntil, params }: Ctx): Promise<Response> {
  const parts = rest(request, params);
  const key = env.TOMTOM_API_KEY?.trim();
  if (parts[0] !== "route") return json({ error: "unknown traffic path" }, 0, 404);
  if (!key) return json({ configured: false, travelTimeSec: null, trafficDelaySec: null, speedLimits: [] }, 60);
  try {
    const body = (await request.json()) as { points?: RoutePoint[] };
    const pts = Array.isArray(body.points) ? body.points : [];
    return await routeResponse(null, pts, key, waitUntil);
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timeout" : e instanceof Error ? e.message : "failed";
    return json({ configured: true, error: msg, travelTimeSec: null, trafficDelaySec: null, speedLimits: [] }, 5, 502);
  }
}
