import type { RadarItem, RadarKind } from "./reports";
import { officialIncidents, reportsNear } from "./reports";
import { congestionOf, delaySecOf, type Congestion, type TomTomFlowSample } from "./sources/tomtom";
import { haversineMeters } from "./polyline";
import type { Look } from "./garage";
import { fetchTrafficRoute, speedLimitAt, type SpeedLimitSpan, type TrafficRoute } from "./tomtom-route";
import { TOMTOM_ATTRIBUTION } from "./tomtom-budget";

/**
 * Live traffic helpers. Every number comes from TomTom (via the Pages Function)
 * or from official / driver reports. Nothing is predicted or filled in.
 */

export const TRAFFIC_REFRESH_MS = 120_000;
export const FLOW_SOURCE_LAYER = "Traffic flow";

export type TrafficStatus = { configured: boolean };

export type FlowSample = {
  lon: number;
  lat: number;
  currentMph: number;
  freeMph: number;
  currentSec: number;
  freeSec: number;
  closed: boolean;
  congestion: Congestion;
};

export type RouteTraffic = {
  /** Extra seconds vs free-flow, only from real samples or Routing. */
  delaySec: number;
  /** Share of the line that had a usable sample (0–1). */
  coverage: number;
  worst: Congestion | null;
  samples: FlowSample[];
  travelTimeSec?: number;
  /** TomTom's length for the line it routed (routing only), to check it followed ours. */
  lengthMeters?: number;
  speedLimits?: SpeedLimitSpan[];
  source?: "routing" | "flow";
};

export type TrafficSummary = {
  /** Drive / review line, e.g. "Heavy traffic ahead, +6 min". Null = hide. */
  line: string | null;
  /** Typical-time footnote replacement. */
  etaNote: string;
  delaySec: number;
  live: boolean;
  /** Posted mph from TomTom speedLimit sections at the driver's progress, when sent. */
  speedLimitMph?: number | null;
};

export type AlongPoint = { lon: number; lat: number };

let noKeyLogged = false;

/** Log once when the TomTom Pages secret is missing. Never invent a layer. */
export function logTomTomMissing(): void {
  if (noKeyLogged) return;
  noKeyLogged = true;
  console.info("Slide: TomTom traffic is off. Set the Pages project secret TOMTOM_API_KEY to enable the flow layer.");
}

/** Reset the once-log (tests). */
export function resetTomTomLog(): void {
  noKeyLogged = false;
}

export async function trafficStatus(): Promise<TrafficStatus> {
  try {
    const res = await fetch("/api/traffic/status", { headers: { accept: "application/json" } });
    if (!res.ok) return { configured: false };
    const json = (await res.json()) as { configured?: boolean };
    return { configured: json.configured === true };
  } catch {
    return { configured: false };
  }
}

export async function tomtomIncidents(bbox: [number, number, number, number]): Promise<RadarItem[]> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const q = `${bbox[0].toFixed(4)},${bbox[1].toFixed(4)},${bbox[2].toFixed(4)},${bbox[3].toFixed(4)}`;
    const res = await fetch(`/api/traffic/incidents?bbox=${q}`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { configured?: boolean; items?: RadarItem[] };
    if (json.configured === false) return [];
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(t);
  }
}

export async function trafficAlong(points: AlongPoint[]): Promise<FlowSample[]> {
  if (!points.length) return [];
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 9000);
  try {
    const q = points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join("|");
    const res = await fetch(`/api/traffic/along?points=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { configured?: boolean; samples?: Array<TomTomFlowSample & { lon?: number; lat?: number }> };
    if (json.configured === false || !Array.isArray(json.samples)) return [];
    const out: FlowSample[] = [];
    for (const s of json.samples) {
      const congestion = congestionOf(s);
      const lon = Number(s.lon), lat = Number(s.lat);
      const currentMph = Number(s.currentSpeed), freeMph = Number(s.freeFlowSpeed);
      if (!congestion || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      if (!Number.isFinite(currentMph) || !Number.isFinite(freeMph)) continue;
      out.push({
        lon, lat, currentMph, freeMph,
        currentSec: Number(s.currentTravelTime) || 0,
        freeSec: Number(s.freeFlowTravelTime) || 0,
        closed: s.roadClosure === true,
        congestion,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    window.clearTimeout(t);
  }
}

/** Kinds that belong on the map as traffic/incident icons (not buses or cameras). */
export const MAP_INCIDENT_KINDS: ReadonlySet<RadarKind> = new Set([
  "police", "crash", "hazard", "closure", "jam", "roadwork",
]);

/** Sample the line every ~1.2 mi, first and last always, cap 10 (free-tier). */
export function sampleRoute(coords: Array<[number, number]>, everyMi = 1.2, cap = 10): AlongPoint[] {
  if (!coords.length) return [];
  const first = coords[0];
  const last = coords[coords.length - 1];
  const out: AlongPoint[] = [{ lon: first[0], lat: first[1] }];
  // Spread the samples over the whole line: with a fixed spacing, a long trip
  // ran out of samples part-way and the rest of the route went unmeasured.
  let totalMi = 0;
  for (let i = 1; i < coords.length; i++) totalMi += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]) / 1609.344;
  if (cap > 2) everyMi = Math.max(everyMi, totalMi / (cap - 1));
  let acc = 0;
  for (let i = 1; i < coords.length - 1 && out.length < cap - 1; i++) {
    acc += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]) / 1609.344;
    if (acc >= everyMi) {
      out.push({ lon: coords[i][0], lat: coords[i][1] });
      acc = 0;
    }
  }
  if (coords.length > 1) out.push({ lon: last[0], lat: last[1] });
  return out.slice(0, cap);
}

/**
 * Colour each vertex of the line from the nearest real sample. Vertices with
 * no sample within 1.6 mi stay uncoloured (caller keeps the usual ribbon).
 */
export function colorRoute(
  coords: Array<[number, number]>,
  samples: FlowSample[],
): Array<{ a: [number, number]; b: [number, number]; congestion: Congestion }> {
  if (coords.length < 2 || !samples.length) return [];
  const segs: Array<{ a: [number, number]; b: [number, number]; congestion: Congestion }> = [];
  for (let i = 1; i < coords.length; i++) {
    const mid: [number, number] = [(coords[i - 1][0] + coords[i][0]) / 2, (coords[i - 1][1] + coords[i][1]) / 2];
    let best: FlowSample | null = null;
    let bestM = Infinity;
    for (const s of samples) {
      const m = haversineMeters(mid[0], mid[1], s.lon, s.lat);
      if (m < bestM) { bestM = m; best = s; }
    }
    if (!best || bestM > 1609.344 * 1.6) continue;
    segs.push({ a: coords[i - 1], b: coords[i], congestion: best.congestion });
  }
  return segs;
}

/** Live delay from sampled speeds vs Valhalla typical time. Null without coverage. */
export function routeTraffic(typicalSec: number, distanceMi: number, samples: FlowSample[]): RouteTraffic | null {
  if (!samples.length || distanceMi < 0.05 || typicalSec <= 0) return null;
  let liveSec = 0;
  let covered = 0;
  const span = distanceMi / samples.length;
  let worst: Congestion | null = null;
  const rank: Record<Congestion, number> = { free: 0, slow: 1, heavy: 2 };
  for (const s of samples) {
    if (s.closed || s.currentMph <= 0) {
      liveSec += span / 8 * 3600;
      covered += span;
      worst = "heavy";
      continue;
    }
    liveSec += (span / s.currentMph) * 3600;
    covered += span;
    if (!worst || rank[s.congestion] > rank[worst]) worst = s.congestion;
  }
  const coverage = Math.min(1, covered / distanceMi);
  if (coverage < 0.35) return null;
  const delaySec = Math.max(0, Math.round(liveSec - typicalSec));
  return { delaySec, coverage, worst, samples, source: "flow" };
}

function formatMin(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return `${m} min`;
}

/**
 * Drive / review copy from real delay + the nearest incident ahead on the line.
 * Never says "heavy" without a sample or a jam/crash/closure.
 */
export function routeTrafficFromRouting(route: TrafficRoute): RouteTraffic {
  const delay = route.trafficDelaySec;
  const worst: Congestion | null = delay >= 180 ? "heavy" : delay >= 45 ? "slow" : "free";
  return {
    delaySec: delay,
    coverage: 1,
    worst,
    samples: [],
    travelTimeSec: route.travelTimeSec,
    lengthMeters: route.lengthMeters,
    speedLimits: route.speedLimits,
    source: "routing",
  };
}

export function trafficSummary(input: {
  traffic: RouteTraffic | null;
  ahead: RadarItem | null;
  aheadMi: number | null;
  tomtom: boolean;
  on: boolean;
  alongMi?: number;
}): TrafficSummary {
  const speedLimitMph = input.on ? speedLimitAt(input.traffic?.speedLimits, input.alongMi ?? 0) : null;
  const attr = input.traffic?.source === "routing" ? ` · ${TOMTOM_ATTRIBUTION}` : "";
  if (!input.on) {
    return { line: null, etaNote: "Typical time · traffic off", delaySec: 0, live: false, speedLimitMph };
  }
  const delay = input.traffic?.delaySec ?? 0;
  const live = Boolean(input.traffic);
  const worst = input.traffic?.worst ?? null;
  const ahead = input.ahead;
  const mi = input.aheadMi;

  if (ahead && mi !== null && mi >= 0 && mi < 8) {
    const dist = mi < 0.15 ? "just ahead" : `in ${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
    const kind =
      ahead.kind === "crash" ? "Crash" :
      ahead.kind === "closure" ? "Road closed" :
      ahead.kind === "roadwork" ? "Roadwork" :
      ahead.kind === "hazard" ? "Hazard" :
      ahead.kind === "police" ? "Police reported" :
      ahead.kind === "jam" ? "Congestion" : ahead.title;
    const extra = live && delay >= 45 ? `, +${formatMin(delay)}` : "";
    return {
      line: `${kind} ${dist}${extra}`,
      etaNote: live ? `Live traffic${delay >= 45 ? ` · +${formatMin(delay)}` : ""}${attr}` : "Typical time · official incidents",
      delaySec: live ? delay : 0,
      live,
      speedLimitMph,
    };
  }

  if (live && worst === "heavy" && delay >= 45) {
    return { line: `Heavy traffic ahead, +${formatMin(delay)}`, etaNote: `Live traffic · +${formatMin(delay)}${attr}`, delaySec: delay, live: true, speedLimitMph };
  }
  if (live && worst === "slow" && delay >= 45) {
    return { line: `Slow traffic, +${formatMin(delay)}`, etaNote: `Live traffic · +${formatMin(delay)}${attr}`, delaySec: delay, live: true, speedLimitMph };
  }
  if (live) {
    return { line: delay >= 45 ? `Traffic on this line, +${formatMin(delay)}` : "Traffic moving", etaNote: delay >= 45 ? `Live traffic · +${formatMin(delay)}${attr}` : `Live traffic${attr}`, delaySec: delay, live: true, speedLimitMph };
  }
  if (input.tomtom) {
    return { line: null, etaNote: "Live traffic · measuring this line", delaySec: 0, live: false, speedLimitMph };
  }
  return { line: null, etaNote: "Typical time · no live speeds (TomTom key not set)", delaySec: 0, live: false, speedLimitMph };
}

/** Nearest map-incident along the remaining line (ahead of `alongMi`). */
export function incidentAhead(
  items: RadarItem[],
  coords: Array<[number, number]>,
  alongMi: number,
): { item: RadarItem; mi: number } | null {
  if (!items.length || coords.length < 2) return null;
  let best: { item: RadarItem; mi: number } | null = null;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const seg = haversineMeters(a[0], a[1], b[0], b[1]) / 1609.344;
    const at = acc + seg / 2;
    acc += seg;
    if (at < alongMi - 0.02) continue;
    for (const it of items) {
      if (!MAP_INCIDENT_KINDS.has(it.kind)) continue;
      const d = haversineMeters((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, it.lon, it.lat) / 1609.344;
      if (d > 0.18) continue;
      const mi = Math.max(0, at - alongMi);
      if (!best || mi < best.mi) best = { item: it, mi };
    }
  }
  return best;
}

/** Merge official + driver + TomTom, drop transit/cameras, newest first, cap. */
export function mergeMapIncidents(...lists: RadarItem[][]): RadarItem[] {
  const seen = new Set<string>();
  const out: RadarItem[] = [];
  for (const list of lists) {
    for (const it of list) {
      if (!MAP_INCIDENT_KINDS.has(it.kind)) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 80);
}

/** Viewport / route fetch of official + driver reports (no TomTom). */
export async function localIncidents(lat: number, lon: number, km = 18): Promise<RadarItem[]> {
  const [official, drivers] = await Promise.all([
    officialIncidents(lat, lon, km),
    reportsNear(lat, lon, Math.min(km, 8)).catch(() => [] as RadarItem[]),
  ]);
  return mergeMapIncidents(official, drivers);
}

export type FlowPaint = { free: string; slow: string; heavy: string; case: string };

const FLOW_FALLBACK: Record<Look, FlowPaint> = {
  night: { free: "#5dd17e", slow: "#f0a14a", heavy: "#e5484d", case: "#05070a" },
  ember: { free: "#6ee08a", slow: "#ffd24a", heavy: "#ff5a62", case: "#140806" },
  sand: { free: "#5dd17e", slow: "#ff8c2a", heavy: "#e5484d", case: "#100e0a" },
};

/** Theme-aware G/Y/R + dark case from tokens. Ember/Sand avoid the road hue. */
export function flowPaint(look: Look): FlowPaint {
  const fb = FLOW_FALLBACK[look] ?? FLOW_FALLBACK.night;
  if (typeof document === "undefined") return fb;
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    free: read("--flow-free", fb.free),
    slow: read("--flow-slow", fb.slow),
    heavy: read("--flow-heavy", fb.heavy),
    case: read("--flow-case", fb.case),
  };
}

export function delayOfSample(s: TomTomFlowSample): number | null {
  return delaySecOf(s);
}

export { congestionOf, delaySecOf, fetchTrafficRoute, speedLimitAt };
export type { Congestion, SpeedLimitSpan, TrafficRoute };
