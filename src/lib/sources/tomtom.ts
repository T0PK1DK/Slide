import type { RadarItem, RadarKind } from "../reports";

/**
 * TomTom Traffic Incident Details (v5) → radar items. Pure mapping only.
 * The Pages Function holds the key and calls the API; this file never invents
 * a crash, jam or delay. Unknown categories are dropped, not guessed.
 *
 * iconCategory (TomTom):
 *   1 Accident · 6 Jam · 7 Lane closed · 8 Road closed · 9 Road works
 *   2 Fog · 3 Dangerous conditions · 4 Rain · 5 Ice · 10 Wind · 11 Flooding
 *   14 Broken-down vehicle · 0 Unknown (skipped)
 */
export type TomTomIncident = {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    id?: string;
    iconCategory?: number;
    magnitudeOfDelay?: number;
    startTime?: string;
    endTime?: string;
    from?: string;
    to?: string;
    delay?: number;
    length?: number;
    roadNumbers?: string[];
    events?: Array<{ description?: string; code?: number; iconCategory?: number }>;
  };
};

export type TomTomFlowSample = {
  currentSpeed?: number;
  freeFlowSpeed?: number;
  currentTravelTime?: number;
  freeFlowTravelTime?: number;
  confidence?: number;
  roadClosure?: boolean;
};

/** Congestion along a stretch: free / slow / heavy. Never a fourth "guess". */
export type Congestion = "free" | "slow" | "heavy";

const TOMTOM_KIND: Partial<Record<number, RadarKind>> = {
  1: "crash",
  6: "jam",
  7: "closure",
  8: "closure",
  9: "roadwork",
  2: "hazard",
  3: "hazard",
  4: "hazard",
  5: "hazard",
  10: "hazard",
  11: "hazard",
  14: "hazard",
};

const KIND_TITLE: Record<RadarKind, string> = {
  police: "Police reported",
  crash: "Crash",
  hazard: "Hazard",
  closure: "Road closed",
  jam: "Congestion",
  roadwork: "Roadwork",
  camera: "Enforcement camera",
  bus: "Bus",
  rail: "Train",
};

/** Pure: first usable lon/lat from a GeoJSON position, line or polygon. */
export function firstCoord(coords: unknown): { lon: number; lat: number } | null {
  if (!Array.isArray(coords) || coords.length < 1) return null;
  const a = coords[0];
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    const lon = Number(coords[0]), lat = Number(coords[1]);
    return Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : null;
  }
  if (Array.isArray(a)) return firstCoord(a);
  return null;
}

/** Pure: TomTom icon category → radar kind, or null to skip. */
export function tomtomKind(iconCategory: number): RadarKind | null {
  return TOMTOM_KIND[iconCategory] ?? null;
}

/** Pure: one Incident Details feature → radar item, or null without a position/type. */
export function fromTomTom(inc: TomTomIncident, now = Date.now()): RadarItem | null {
  const p = inc.properties ?? {};
  const kind = tomtomKind(Number(p.iconCategory));
  const at = firstCoord(inc.geometry?.coordinates);
  if (!kind || !at) return null;
  const ev = p.events?.[0];
  const desc = (ev?.description ?? "").replace(/\s+/g, " ").trim();
  const road = (p.roadNumbers ?? []).filter(Boolean).join(" / ");
  const from = (p.from ?? "").trim();
  const to = (p.to ?? "").trim();
  const where = [...new Set([from && to ? `${from} → ${to}` : from || to, road].filter(Boolean))].join(" · ");
  const start = Date.parse(String(p.startTime ?? ""));
  const id = String(p.id ?? `${at.lat},${at.lon}`);
  return {
    id: `tomtom-${id}`,
    source: "tomtom",
    kind,
    lat: at.lat,
    lon: at.lon,
    title: [KIND_TITLE[kind], where].filter(Boolean).join(" · "),
    detail: `TomTom · ${desc || KIND_TITLE[kind]}`,
    createdAt: Number.isFinite(start) ? start : now,
    confirms: 0,
    reportId: null,
  };
}

/**
 * Pure: current vs free-flow speed → congestion. Ratio is current/free.
 *   ≥ 0.75 free (green) · 0.40–0.75 slow (yellow) · < 0.40 heavy (red)
 * A closed road is always heavy. Missing speeds return null — never a fake colour.
 */
export function congestionOf(sample: TomTomFlowSample): Congestion | null {
  if (sample.roadClosure) return "heavy";
  const cur = Number(sample.currentSpeed);
  const free = Number(sample.freeFlowSpeed);
  if (!Number.isFinite(cur) || !Number.isFinite(free) || free <= 0) return null;
  const r = cur / free;
  if (r >= 0.75) return "free";
  if (r >= 0.4) return "slow";
  return "heavy";
}

/**
 * Pure: extra seconds vs free flow for one TomTom segment. Null when the
 * payload has no usable times — callers must not invent a delay.
 */
export function delaySecOf(sample: TomTomFlowSample): number | null {
  if (sample.roadClosure) return null;
  const cur = Number(sample.currentTravelTime);
  const free = Number(sample.freeFlowTravelTime);
  if (!Number.isFinite(cur) || !Number.isFinite(free) || free < 0) return null;
  return Math.max(0, cur - free);
}

/** Incident Details fields the Function asks for (present events only). */
export const TOMTOM_INCIDENT_FIELDS =
  "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity}}}";

export const TOMTOM_FLOW_TILE = (z: number, x: number, y: number, key: string) =>
  `https://api.tomtom.com/traffic/map/4/tile/flow/relative/${z}/${x}/${y}.pbf?key=${encodeURIComponent(key)}`;

export const TOMTOM_INCIDENTS = (bbox: string, key: string) =>
  `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${encodeURIComponent(key)}&bbox=${encodeURIComponent(bbox)}&fields=${encodeURIComponent(TOMTOM_INCIDENT_FIELDS)}&language=en-US&timeValidityFilter=present`;

export const TOMTOM_FLOW_SEGMENT = (lat: number, lon: number, key: string) =>
  `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lon}&unit=MPH&key=${encodeURIComponent(key)}`;

/** Calculate Route (traffic-aware times). Key stays in the Pages Function. */
export type TomTomRouteSummary = {
  lengthInMeters?: number;
  travelTimeInSeconds?: number;
  trafficDelayInSeconds?: number;
  noTrafficTravelTimeInSeconds?: number;
  liveTrafficIncidentsTravelTimeInSeconds?: number;
};

export type TomTomRouteResult = {
  travelSec: number;
  delaySec: number;
  lengthM: number;
};

/** Pure: one Calculate Route entry → live time, or null without a real travelTime. */
export function fromTomTomRoute(route: { summary?: TomTomRouteSummary } | null | undefined): TomTomRouteResult | null {
  const travel = Number(route?.summary?.travelTimeInSeconds);
  if (!Number.isFinite(travel) || travel <= 0) return null;
  const delay = Number(route?.summary?.trafficDelayInSeconds);
  const lengthM = Number(route?.summary?.lengthInMeters);
  return {
    travelSec: Math.round(travel),
    delaySec: Number.isFinite(delay) ? Math.max(0, Math.round(delay)) : 0,
    lengthM: Number.isFinite(lengthM) && lengthM > 0 ? Math.round(lengthM) : 0,
  };
}

export const TOMTOM_CALCULATE_ROUTE = (
  locations: string,
  key: string,
  opts: { alternatives?: number } = {},
) => {
  const q = new URLSearchParams({
    key,
    traffic: "true",
    computeTravelTimeFor: "all",
    travelMode: "car",
    routeType: "fastest",
    maxAlternatives: String(Math.max(0, Math.min(5, opts.alternatives ?? 0))),
  });
  return `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?${q}`;
};
