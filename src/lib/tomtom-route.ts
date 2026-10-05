/**
 * TomTom Routing overlay for an existing Valhalla line.
 *
 * Leon's `reroute.ts` can call `fetchTrafficRoute()` for live drive time and
 * traffic delay. This does not replace Valhalla and does not own reroute UI.
 * The key stays in Pages Functions (`/api/traffic/route`).
 */
import { haversineMeters } from "./polyline";
import { TOMTOM_ATTRIBUTION } from "./tomtom-budget";

export type RoutePoint = { lat: number; lon: number };

export type TrafficRouteQuery = {
  points: RoutePoint[];
  signal?: AbortSignal;
};

export type SpeedLimitSpan = {
  fromMi: number;
  toMi: number;
  mph: number;
};

export type TrafficRoute = {
  travelTimeSec: number;
  trafficDelaySec: number;
  noTrafficSec: number | null;
  lengthMeters: number;
  speedLimits: SpeedLimitSpan[];
  attribution: typeof TOMTOM_ATTRIBUTION;
};

export type TrafficRouteResponse = {
  configured?: boolean;
  error?: string;
  travelTimeSec?: number | null;
  trafficDelaySec?: number | null;
  noTrafficSec?: number | null;
  lengthMeters?: number | null;
  speedLimits?: SpeedLimitSpan[];
  attribution?: string;
};

type TomTomPoint = { latitude?: unknown; lat?: unknown; longitude?: unknown; lon?: unknown };
type TomTomSection = {
  startPointIndex?: unknown;
  endPointIndex?: unknown;
  sectionType?: unknown;
  effectiveSpeedLimit?: unknown;
  maxSpeedLimitInKmh?: unknown;
  speedLimitInKmh?: unknown;
  speedLimitUnit?: unknown;
};
type TomTomSummary = {
  lengthInMeters?: unknown;
  travelTimeInSeconds?: unknown;
  trafficDelayInSeconds?: unknown;
  noTrafficTravelTimeInSeconds?: unknown;
};
type TomTomLeg = { points?: TomTomPoint[] };
type TomTomRoute = { summary?: TomTomSummary; legs?: TomTomLeg[]; sections?: TomTomSection[] };

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pointOf(p: TomTomPoint): RoutePoint | null {
  const lat = num(p.latitude ?? p.lat);
  const lon = num(p.longitude ?? p.lon);
  if (lat === null || lon === null) return null;
  return { lat, lon };
}

export function routePointsOf(data: unknown): RoutePoint[] {
  const route = (data as { routes?: TomTomRoute[] } | null)?.routes?.[0];
  if (!route) return [];
  const out: RoutePoint[] = [];
  for (const leg of route.legs ?? []) {
    for (const p of leg.points ?? []) {
      const at = pointOf(p);
      if (at) out.push(at);
    }
  }
  return out;
}

export function milesAlong(points: RoutePoint[]): number[] {
  const acc: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const d = haversineMeters(points[i - 1].lon, points[i - 1].lat, points[i].lon, points[i].lat) / 1609.344;
    acc.push(acc[i - 1] + d);
  }
  return acc;
}

/** km/h → mph for the sign. Pass through when the unit is already MPH. */
export function limitToMph(raw: number, unit?: string): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const u = (unit ?? "").toLowerCase();
  const mph = u === "mph" || u === "mi/h" ? raw : raw * 0.621371;
  const n = Math.round(mph);
  return n > 0 ? n : null;
}

export function speedLimitsOf(data: unknown): SpeedLimitSpan[] {
  const route = (data as { routes?: TomTomRoute[] } | null)?.routes?.[0];
  const sections = route?.sections;
  if (!Array.isArray(sections) || !sections.length) return [];
  const pts = routePointsOf(data);
  const along = milesAlong(pts);
  const out: SpeedLimitSpan[] = [];
  for (const s of sections) {
    const typ = String(s.sectionType ?? "").toUpperCase();
    if (typ && typ !== "SPEED_LIMIT" && typ !== "SPEEDLIMIT") continue;
    const kmh = num(s.maxSpeedLimitInKmh) ?? num(s.speedLimitInKmh) ?? num(s.effectiveSpeedLimit);
    if (kmh === null) continue;
    const mph = limitToMph(kmh, String(s.speedLimitUnit ?? ""));
    if (!mph) continue;
    const a = Math.max(0, Math.round(Number(s.startPointIndex) || 0));
    const b = Math.max(a, Math.round(Number(s.endPointIndex) || a));
    const fromMi = along[Math.min(a, along.length - 1)] ?? 0;
    const toMi = along[Math.min(b, along.length - 1)] ?? fromMi;
    if (toMi < fromMi) continue;
    out.push({ fromMi, toMi: Math.max(toMi, fromMi + 0.01), mph });
  }
  return out;
}

export function trafficRouteOf(data: unknown): TrafficRoute | null {
  const summary = (data as { routes?: TomTomRoute[] } | null)?.routes?.[0]?.summary;
  if (!summary) return null;
  const travel = num(summary.travelTimeInSeconds);
  const length = num(summary.lengthInMeters);
  if (travel === null || length === null || travel < 0 || length < 0) return null;
  const delay = num(summary.trafficDelayInSeconds);
  const none = num(summary.noTrafficTravelTimeInSeconds);
  const trafficDelaySec = delay !== null ? Math.max(0, Math.round(delay)) : none !== null ? Math.max(0, Math.round(travel - none)) : 0;
  return {
    travelTimeSec: Math.round(travel),
    trafficDelaySec,
    noTrafficSec: none !== null ? Math.round(none) : null,
    lengthMeters: Math.round(length),
    speedLimits: speedLimitsOf(data),
    attribution: TOMTOM_ATTRIBUTION,
  };
}

export function speedLimitAt(spans: SpeedLimitSpan[] | undefined, alongMi: number): number | null {
  if (!spans?.length) return null;
  const hit = spans.find((s) => alongMi >= s.fromMi - 1e-6 && alongMi < s.toMi);
  return hit?.mph ?? null;
}

export function supportingPointsOf(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 2) return [];
  return points.slice(1, -1).slice(0, 38);
}

/** Client: one POST to the Pages Function. Null when unconfigured, over budget, or no real payload. */
export async function fetchTrafficRoute(q: TrafficRouteQuery): Promise<TrafficRoute | null> {
  if (q.points.length < 2) return null;
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/traffic/route", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ points: q.points.slice(0, 40) }),
      signal: q.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as TrafficRouteResponse;
    if (json.configured === false) return null;
    const travel = Number(json.travelTimeSec);
    const delay = Number(json.trafficDelaySec);
    const length = Number(json.lengthMeters);
    if (!Number.isFinite(travel) || travel < 0 || !Number.isFinite(length) || length < 0) return null;
    return {
      travelTimeSec: Math.round(travel),
      trafficDelaySec: Number.isFinite(delay) ? Math.max(0, Math.round(delay)) : 0,
      noTrafficSec: Number.isFinite(Number(json.noTrafficSec)) ? Math.round(Number(json.noTrafficSec)) : null,
      lengthMeters: Math.round(length),
      speedLimits: Array.isArray(json.speedLimits) ? json.speedLimits.filter((s) => s && Number.isFinite(s.mph) && s.mph > 0) : [],
      attribution: TOMTOM_ATTRIBUTION,
    };
  } catch {
    return null;
  }
}
