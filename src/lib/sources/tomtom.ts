import { haversineMeters } from "../polyline";
import type { RadarItem, RadarKind } from "../reports";

/**
 * TomTom Traffic API helpers (pure). The key never lives here — Pages
 * Functions add it when they call the upstream URLs.
 *
 * Incident Details v5 iconCategory:
 * 0 unknown, 1 accident, 2 fog, 3 dangerous conditions, 4 rain, 5 ice,
 * 6 jam, 7 lane closed, 8 road closed, 9 road works, 10 wind, 11 flooding,
 * 14 broken-down vehicle. There is no police category; those stay driver reports.
 */
export const TOMTOM_FLOW_STYLE = "relative";
export const TOMTOM_TILE_MAX_Z = 16;
export const TOMTOM_TILE_MIN_Z = 6;

export type Congestion = "free" | "slow" | "heavy" | "standstill";

export type FlowSample = {
  lon: number;
  lat: number;
  currentMph: number;
  freeFlowMph: number;
  currentSec: number;
  freeFlowSec: number;
  closed: boolean;
  congestion: Congestion;
};

export type RouteTraffic = {
  configured: boolean;
  delaySec: number | null;
  samples: FlowSample[];
};

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Pure: iconCategory (number or TomTom name) → radar kind. */
export function tomtomKind(category: unknown): RadarKind {
  const n = typeof category === "number" ? category : Number(category);
  const s = String(category ?? "").toLowerCase();
  if (n === 1 || s === "accident") return "crash";
  if (n === 6 || s === "jam") return "jam";
  if (n === 8 || s === "roadclosed" || s === "road closed") return "closure";
  if (n === 7 || s === "laneclosed" || s === "lane closed") return "closure";
  if (n === 9 || s === "roadworks" || s === "road works") return "roadwork";
  return "hazard";
}

/** Pure: first usable lon/lat from a GeoJSON geometry (Point or LineString). */
export function incidentPoint(geometry: unknown): { lon: number; lat: number } | null {
  if (!isRecord(geometry)) return null;
  const coords = geometry.coordinates;
  const first = firstCoord(coords);
  if (!first) return null;
  const lon = Number(first[0]);
  const lat = Number(first[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  return { lon, lat };
}

function firstCoord(coords: unknown): [unknown, unknown] | null {
  if (!Array.isArray(coords) || coords.length < 1) return null;
  const a = coords[0];
  if (typeof a === "number" && typeof coords[1] === "number") return [coords[0], coords[1]];
  if (Array.isArray(a)) return firstCoord(a);
  return null;
}

const INCIDENT_FIELDS =
  "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},from,to,startTime,lastReportTime,delay,length,roadNumbers}}}";

/** Pure: Incident Details v5 URL. Key is appended by the Worker. */
export function incidentDetailsUrl(bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }, key: string): string {
  const q = new URLSearchParams({
    key,
    bbox: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
    fields: INCIDENT_FIELDS,
    language: "en-US",
    timeValidityFilter: "present",
  });
  return `https://api.tomtom.com/traffic/services/5/incidentDetails?${q}`;
}

/** Pure: raster flow tile URL (`relative` = green / yellow / red / dark red vs free-flow). */
export function flowTileUrl(z: number, x: number, y: number, key: string): string {
  return `https://api.tomtom.com/traffic/map/4/tile/flow/${TOMTOM_FLOW_STYLE}/${z}/${x}/${y}.png?key=${encodeURIComponent(key)}`;
}

/** Pure: flow-segment URL. Zoom 10 is enough to pick a carriageway without extra tile spend. */
export function flowSegmentUrl(lat: number, lon: number, key: string): string {
  const q = new URLSearchParams({
    key,
    point: `${lat},${lon}`,
    unit: "MPH",
  });
  return `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?${q}`;
}

/** Pure: a ~km box around a point, clamped so TomTom's 10,000 km² cap is never hit. */
export function bboxAround(lat: number, lon: number, km = 12): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const radius = Math.min(Math.max(km, 1), 40);
  const dLat = radius / 111;
  const dLon = radius / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    minLon: lon - dLon,
    minLat: lat - dLat,
    maxLon: lon + dLon,
    maxLat: lat + dLat,
  };
}

/** Pure: current vs free-flow → a congestion band. Closed roads are standstill. */
export function congestionFromSpeeds(currentMph: number, freeFlowMph: number, closed = false): Congestion {
  if (closed) return "standstill";
  if (!Number.isFinite(currentMph) || !Number.isFinite(freeFlowMph) || freeFlowMph <= 0) return "free";
  const ratio = currentMph / freeFlowMph;
  if (ratio >= 0.7) return "free";
  if (ratio >= 0.4) return "slow";
  if (ratio >= 0.2) return "heavy";
  return "standstill";
}

/** Classic relative-flow colours (same idea as TomTom's relative raster). */
export const CONGESTION_COLOR: Record<Congestion, string> = {
  free: "#3dcc6e",
  slow: "#f5c14a",
  heavy: "#e5484d",
  standstill: "#7a1224",
};

/** Pure: Worker JSON or a raw flowSegmentData object → a sample. */
export function readFlowSample(raw: unknown, fallback: { lon: number; lat: number }): FlowSample | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.congestion === "string" && typeof raw.currentMph === "number") {
    const congestion = raw.congestion as Congestion;
    if (congestion !== "free" && congestion !== "slow" && congestion !== "heavy" && congestion !== "standstill") return null;
    const lon = Number(raw.lon);
    const lat = Number(raw.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return {
      lon,
      lat,
      currentMph: Number(raw.currentMph) || 0,
      freeFlowMph: Number(raw.freeFlowMph) || 0,
      currentSec: Number(raw.currentSec) || 0,
      freeFlowSec: Number(raw.freeFlowSec) || 0,
      closed: raw.closed === true,
      congestion,
    };
  }
  return fromFlowSegment(raw, fallback);
}

/** Pure: one flowSegmentData object → a sample, or null without usable speeds. */
export function fromFlowSegment(raw: unknown, fallback: { lon: number; lat: number }): FlowSample | null {
  const root = isRecord(raw) ? (isRecord(raw.flowSegmentData) ? raw.flowSegmentData : raw) : null;
  if (!root) return null;
  const currentMph = Number(root.currentSpeed);
  const freeFlowMph = Number(root.freeFlowSpeed);
  const currentSec = Number(root.currentTravelTime);
  const freeFlowSec = Number(root.freeFlowTravelTime);
  const closed = root.roadClosure === true;
  if (!closed && (!Number.isFinite(currentMph) || !Number.isFinite(freeFlowMph) || freeFlowMph <= 0)) return null;
  const coords = isRecord(root.coordinates) ? root.coordinates.coordinate : null;
  const first = Array.isArray(coords) && isRecord(coords[0]) ? coords[0] : null;
  const lat = Number(first?.latitude ?? fallback.lat);
  const lon = Number(first?.longitude ?? fallback.lon);
  return {
    lon: Number.isFinite(lon) ? lon : fallback.lon,
    lat: Number.isFinite(lat) ? lat : fallback.lat,
    currentMph: Number.isFinite(currentMph) ? currentMph : 0,
    freeFlowMph: Number.isFinite(freeFlowMph) ? freeFlowMph : 0,
    currentSec: Number.isFinite(currentSec) ? currentSec : 0,
    freeFlowSec: Number.isFinite(freeFlowSec) ? freeFlowSec : 0,
    closed,
    congestion: congestionFromSpeeds(currentMph, freeFlowMph, closed),
  };
}

/**
 * Pure: delay versus free-flow from real samples only.
 * Each sample is a TomTom road fragment; we sum unique fragments (rounded
 * to ~100 m) so overlapping probes don't double-count. Returns null when
 * nothing usable came back — never a guessed zero.
 */
export function delayFromSamples(samples: readonly FlowSample[]): number | null {
  if (!samples.length) return null;
  const seen = new Set<string>();
  let current = 0;
  let free = 0;
  let any = false;
  for (const s of samples) {
    const key = `${s.lon.toFixed(3)},${s.lat.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (s.closed) {
      any = true;
      continue;
    }
    if (s.currentSec > 0 && s.freeFlowSec > 0) {
      current += s.currentSec;
      free += s.freeFlowSec;
      any = true;
    }
  }
  if (!any || free <= 0) return null;
  return Math.max(0, Math.round(current - free));
}

/** Pure: "+6 min traffic", or null when there is no real delay to show. */
export function formatTrafficDelay(delaySec: number | null): string | null {
  if (delaySec === null || delaySec < 45) return null;
  const min = Math.round(delaySec / 60);
  if (min < 1) return null;
  return `+${min} min traffic`;
}

/** Walk a line and pick points ~`stepM` apart, capped — keeps the free tier honest. */
export function sampleRoutePoints(coords: ReadonlyArray<[number, number]>, stepM = 1800, maxPoints = 10): Array<[number, number]> {
  if (coords.length === 0) return [];
  if (coords.length === 1) return [coords[0]];
  const out: Array<[number, number]> = [coords[0]];
  let acc = 0;
  for (let i = 1; i < coords.length && out.length < maxPoints - 1; i++) {
    const [aLon, aLat] = coords[i - 1];
    const [bLon, bLat] = coords[i];
    acc += haversineMeters(aLon, aLat, bLon, bLat);
    if (acc >= stepM) {
      out.push(coords[i]);
      acc = 0;
    }
  }
  const last = coords[coords.length - 1];
  const prev = out[out.length - 1];
  if (prev[0] !== last[0] || prev[1] !== last[1]) out.push(last);
  return out.slice(0, maxPoints);
}

/** Split a line into coloured pieces using the nearest real flow sample. */
export function colorRouteBySamples(
  coords: ReadonlyArray<[number, number]>,
  samples: readonly FlowSample[],
): Array<{ coordinates: [number, number][]; congestion: Congestion }> {
  if (coords.length < 2 || samples.length === 0) return [];
  const pieces: Array<{ coordinates: [number, number][]; congestion: Congestion }> = [];
  let run: [number, number][] = [coords[0]];
  let level = nearestCongestion(coords[0], samples);
  for (let i = 1; i < coords.length; i++) {
    const next = nearestCongestion(coords[i], samples);
    if (next !== level && run.length >= 1) {
      run.push(coords[i]);
      pieces.push({ coordinates: run, congestion: level });
      run = [coords[i]];
      level = next;
    } else {
      run.push(coords[i]);
    }
  }
  if (run.length >= 2) pieces.push({ coordinates: run, congestion: level });
  return pieces;
}

function nearestCongestion(pt: [number, number], samples: readonly FlowSample[]): Congestion {
  let best: Congestion = samples[0].congestion;
  let bestD = Infinity;
  for (const s of samples) {
    const d = haversineMeters(pt[0], pt[1], s.lon, s.lat);
    if (d < bestD) {
      bestD = d;
      best = s.congestion;
    }
  }
  return best;
}

const KIND_LABEL: Record<RadarKind, string> = {
  police: "Police",
  crash: "Crash",
  hazard: "Hazard",
  closure: "Closure",
  jam: "Jam",
  roadwork: "Construction",
  camera: "Camera",
  bus: "Bus",
  rail: "Train",
};

/** Card copy from a real item only — type, road, delay, when. */
export function incidentCard(item: RadarItem, now = Date.now()): { type: string; road: string; delay: string | null; when: string } {
  const road = (item.road ?? "").trim() || roadFromTitle(item.title) || "Road not named";
  const delay = item.delaySec != null && item.delaySec >= 45 ? formatTrafficDelay(item.delaySec) : null;
  return {
    type: KIND_LABEL[item.kind] ?? "Incident",
    road,
    delay,
    when: agoShort(item.createdAt, now),
  };
}

function roadFromTitle(title: string): string {
  const on = /(?:on|at)\s+(.+)$/i.exec(title.trim());
  return on ? on[1].trim() : "";
}

function agoShort(ts: number, now: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "Time unknown";
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return "Reported just now";
  if (m < 60) return `Reported ${m} min ago`;
  return `Reported ${Math.round(m / 60)} hr ago`;
}

/** Pure: one Incident Details feature → radar item, or null without a position. */
export function fromTomTomIncident(f: { geometry?: unknown; properties?: Raw }, nowMs = Date.now()): RadarItem | null {
  const p = f.properties ?? {};
  const pt = incidentPoint(f.geometry);
  if (!pt) return null;
  const events = Array.isArray(p.events) ? p.events.filter(isRecord) : [];
  const desc = String(events[0]?.description ?? "").replace(/\s+/g, " ").trim();
  const kind = tomtomKind(p.iconCategory ?? events[0]?.iconCategory);
  const roads = Array.isArray(p.roadNumbers) ? p.roadNumbers.map((r) => String(r).trim()).filter(Boolean) : [];
  const from = String(p.from ?? "").trim();
  const to = String(p.to ?? "").trim();
  const road = roads[0] || from;
  const delaySec = Number(p.delay);
  const start = Date.parse(String(p.startTime ?? p.lastReportTime ?? ""));
  const id = String(p.id ?? `${pt.lat},${pt.lon}`);
  const stretch = [from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(" ");
  return {
    id: `tomtom-${id}`,
    source: "tomtom",
    kind,
    lat: pt.lat,
    lon: pt.lon,
    title: [desc || KIND_LABEL[kind], road && `on ${road}`].filter(Boolean).join(" "),
    detail: `TomTom · ${stretch || desc || "Live incident"}`,
    createdAt: Number.isFinite(start) ? start : nowMs,
    confirms: 0,
    reportId: null,
    road: road || undefined,
    delaySec: Number.isFinite(delaySec) && delaySec > 0 ? Math.round(delaySec) : null,
  };
}

const DEDUPE_M = 160;
const SOURCE_RANK: Record<RadarItem["source"], number> = {
  tomtom: 5,
  fdot: 4,
  fl511: 3,
  mdpd: 2,
  driver: 1,
  osm: 0,
  transit: 0,
};

const DEDUPE_KINDS = new Set<RadarKind>(["police", "crash", "hazard", "closure", "jam", "roadwork"]);

/**
 * Pure: drop overlapping reports of the same kind from different sources.
 * Prefer the item with a delay, then the more official source, then the newer one.
 * Cameras and transit are never collapsed — they are not traffic incidents.
 */
export function dedupeIncidents(items: readonly RadarItem[]): RadarItem[] {
  const kept: RadarItem[] = [];
  for (const item of [...items].sort(betterFirst)) {
    if (!DEDUPE_KINDS.has(item.kind)) {
      kept.push(item);
      continue;
    }
    const twin = kept.find((k) => k.kind === item.kind && haversineMeters(k.lon, k.lat, item.lon, item.lat) <= DEDUPE_M);
    if (!twin) kept.push(item);
  }
  return kept;
}

function betterFirst(a: RadarItem, b: RadarItem): number {
  const da = a.delaySec != null && a.delaySec > 0 ? 1 : 0;
  const db = b.delaySec != null && b.delaySec > 0 ? 1 : 0;
  if (db !== da) return db - da;
  const ra = SOURCE_RANK[a.source] ?? 0;
  const rb = SOURCE_RANK[b.source] ?? 0;
  if (rb !== ra) return rb - ra;
  return b.createdAt - a.createdAt;
}

export const INCIDENT_ICON_KINDS: ReadonlyArray<RadarKind> = ["police", "crash", "hazard", "closure", "jam", "roadwork"];

export function isIncidentIconKind(kind: RadarKind): boolean {
  return INCIDENT_ICON_KINDS.includes(kind);
}
