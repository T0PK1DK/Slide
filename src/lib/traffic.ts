import type { RadarItem } from "./reports";
import { officialIncidents, reportsNear, tomtomIncidents } from "./reports";
import {
  colorRouteBySamples,
  delayFromSamples,
  formatTrafficDelay,
  readFlowSample,
  sampleRoutePoints,
  type Congestion,
  type FlowSample,
  type RouteTraffic,
} from "./sources/tomtom";

export type TrafficStatus = { configured: boolean };

/** GET /api/traffic/status — false on any failure so the flow layer stays hidden. */
export async function trafficStatus(): Promise<TrafficStatus> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch("/api/traffic/status", { signal: ctrl.signal });
    if (!res.ok) return { configured: false };
    const json = (await res.json()) as { configured?: unknown };
    return { configured: json.configured === true };
  } catch {
    return { configured: false };
  } finally {
    window.clearTimeout(t);
  }
}

export const TRAFFIC_FLOW_TILES = "/api/traffic/flow/{z}/{x}/{y}";

/**
 * Live delay + per-sample congestion for a line. The Worker samples TomTom
 * Flow Segment Data; we never invent a delay when the answer is empty.
 */
export async function fetchRouteTraffic(coords: ReadonlyArray<[number, number]>): Promise<RouteTraffic> {
  const pts = sampleRoutePoints(coords);
  if (!pts.length) return { configured: false, delaySec: null, samples: [] };
  const q = pts.map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join("|");
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`/api/traffic/route?pts=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    if (!res.ok) return { configured: false, delaySec: null, samples: [] };
    const json = (await res.json()) as { configured?: boolean; samples?: unknown[] };
    if (json.configured !== true) return { configured: false, delaySec: null, samples: [] };
    const samples = (Array.isArray(json.samples) ? json.samples : [])
      .map((raw, i) => readFlowSample(raw, { lon: pts[Math.min(i, pts.length - 1)][0], lat: pts[Math.min(i, pts.length - 1)][1] }))
      .filter((s): s is FlowSample => s !== null);
    return { configured: true, delaySec: delayFromSamples(samples), samples };
  } catch {
    return { configured: false, delaySec: null, samples: [] };
  } finally {
    window.clearTimeout(t);
  }
}

/** Official + TomTom + driver reports. Each source fails on its own. */
export async function loadMapIncidents(lat: number, lon: number): Promise<RadarItem[]> {
  const [official, tomtom, drivers] = await Promise.all([
    officialIncidents(lat, lon),
    tomtomIncidents(lat, lon),
    reportsNear(lat, lon).catch(() => [] as RadarItem[]),
  ]);
  return [...official, ...tomtom, ...drivers];
}

export function trafficDelayLabel(info: RouteTraffic | null): string | null {
  if (!info || !info.configured) return null;
  return formatTrafficDelay(info.delaySec);
}

export function reviewTrafficNote(info: RouteTraffic | null): string {
  const label = trafficDelayLabel(info);
  if (label) return `Live traffic · ${label} vs free-flow`;
  if (info?.configured) return "Live traffic · typical time";
  return "Typical time · no live traffic yet";
}

export type ColoredPiece = { coordinates: [number, number][]; congestion: Congestion };

export function coloredRoutePieces(coords: ReadonlyArray<[number, number]>, samples: readonly FlowSample[]): ColoredPiece[] {
  return colorRouteBySamples(coords, samples);
}

export type { Congestion, FlowSample, RouteTraffic };
export { CONGESTION_COLOR, formatTrafficDelay, sampleRoutePoints } from "./sources/tomtom";
