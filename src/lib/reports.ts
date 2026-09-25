import { cloud, cloudConfigured } from "./cloud";

/**
 * Everything the radar can show, from real sources only:
 *   - "driver": reports other Slide drivers filed (police, crash, hazard, closure, jam)
 *   - "fl511":  official Florida 511 incidents, closures and roadwork (via /api/incidents)
 * Nothing is predicted or invented, and police items are always worded as
 * "reported by drivers" — Slide doesn't track police vehicles; nobody can legally.
 */
export type RadarKind = "police" | "crash" | "hazard" | "closure" | "jam" | "roadwork" | "camera" | "bus" | "rail";
/** Kinds a driver can report (the rest come from official or open data). */
export type ReportableKind = "police" | "crash" | "hazard" | "closure" | "jam";
export type RadarItem = {
  id: string;
  source: "driver" | "fl511" | "osm" | "transit";
  kind: RadarKind;
  lat: number;
  lon: number;
  title: string;
  detail: string;
  createdAt: number;
  confirms: number;
  /** Only driver reports can be voted on. */
  reportId: number | null;
};

export const REPORT_KINDS: ReadonlyArray<{ kind: ReportableKind; label: string }> = [
  { kind: "police", label: "Police" },
  { kind: "crash", label: "Crash" },
  { kind: "hazard", label: "Hazard" },
  { kind: "closure", label: "Closure" },
  { kind: "jam", label: "Traffic jam" },
];

const KIND_TITLE: Record<RadarKind, string> = {
  police: "Police reported",
  crash: "Crash reported",
  hazard: "Hazard reported",
  closure: "Road closed",
  jam: "Traffic jam reported",
  roadwork: "Roadwork",
  camera: "Enforcement camera",
  bus: "Bus",
  rail: "Train",
};

const MI_PER_DEG_LAT = 69.055;

/** Pure: flat-earth offset in miles from `you` to `p` (east, north). Fine at radar scale. */
export function offsetMi(you: { lat: number; lon: number }, p: { lat: number; lon: number }): { east: number; north: number } {
  return {
    east: (p.lon - you.lon) * MI_PER_DEG_LAT * Math.cos((you.lat * Math.PI) / 180),
    north: (p.lat - you.lat) * MI_PER_DEG_LAT,
  };
}

export type Blip = RadarItem & { distMi: number; x: number; y: number; ahead: boolean };

/**
 * Pure: place items on a heading-up radar. x/y are -1..1 (edge = `rangeMi`),
 * y negative = ahead. "Ahead" = within ±35° of your heading.
 */
export function radarBlips(items: RadarItem[], you: { lat: number; lon: number }, headingDeg: number | null, rangeMi: number): Blip[] {
  const h = ((headingDeg ?? 0) * Math.PI) / 180;
  const out: Blip[] = [];
  for (const it of items) {
    const { east, north } = offsetMi(you, it);
    const distMi = Math.hypot(east, north);
    if (distMi > rangeMi) continue;
    // Rotate so your heading points up.
    const right = east * Math.cos(h) - north * Math.sin(h);
    const fwd = east * Math.sin(h) + north * Math.cos(h);
    const angle = (Math.atan2(right, fwd) * 180) / Math.PI;
    out.push({ ...it, distMi, x: right / rangeMi, y: -fwd / rangeMi, ahead: headingDeg !== null && fwd > 0 && Math.abs(angle) <= 35 });
  }
  return out.sort((a, b) => a.distMi - b.distMi);
}

/** How close (miles, ahead) each kind earns a heads-up. Transit and jams never alert. */
const ALERT_WITHIN: Partial<Record<RadarKind, number>> = { police: 0.8, crash: 0.8, closure: 0.8, hazard: 0.8, camera: 0.3 };

/** Pure: the one thing worth a heads-up — the nearest alert-worthy item ahead in range, not already alerted. */
export function nextAlert(blips: Blip[], alerted: ReadonlySet<string>): Blip | null {
  return blips.find((b) => b.ahead && b.distMi <= (ALERT_WITHIN[b.kind] ?? -1) && !alerted.has(b.id)) ?? null;
}

/** Pure: "4 min ago", "just now". */
export function ago(ts: number, now = Date.now()): string {
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} hr ago`;
}

type ReportRow = { id: number; kind: RadarKind; lat: number; lon: number; created_at: string; confirms: number };

/** Pure: a reports_near() row → a radar item. */
export function fromReportRow(r: ReportRow): RadarItem {
  return {
    id: `r${r.id}`,
    source: "driver",
    kind: r.kind,
    lat: r.lat,
    lon: r.lon,
    title: KIND_TITLE[r.kind] ?? "Reported",
    detail: `Reported by drivers${r.confirms ? ` · ${r.confirms} confirmed` : ""}`,
    createdAt: Date.parse(r.created_at),
    confirms: r.confirms,
    reportId: r.id,
  };
}

export async function reportsNear(lat: number, lon: number, km = 8): Promise<RadarItem[]> {
  if (!cloudConfigured()) return [];
  const sb = await cloud();
  const { data, error } = await sb.rpc("reports_near", { p_lat: lat, p_lon: lon, p_km: km });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReportRow[]).map(fromReportRow);
}

export async function submitReport(kind: ReportableKind, lat: number, lon: number, heading: number | null): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.rpc("submit_report", {
    p_kind: kind,
    p_lat: lat,
    p_lon: lon,
    p_heading: heading === null ? null : Math.round(((heading % 360) + 360) % 360),
  });
  if (error) throw new Error(/sign in|profile/i.test(error.message) ? "Sign in and set up your driver profile to report." : error.message);
}

export async function voteReport(reportId: number, stillThere: boolean): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.rpc("vote_report", { p_id: reportId, p_still_there: stillThere });
  if (error) throw new Error(error.message);
}

/** GET one of our own Pages Function feeds (/api/incidents, /api/cameras, /api/transit). Empty on any failure. */
async function ownFeed(path: string, lat: number, lon: number, km: number): Promise<RadarItem[]> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${path}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&km=${km}`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: RadarItem[] };
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(t);
  }
}

/** Official FL511 incidents (the Function holds the key). */
export const officialIncidents = (lat: number, lon: number, km = 12) => ownFeed("/api/incidents", lat, lon, km);
/** Speed / red-light cameras mapped in OpenStreetMap. */
export const enforcementCameras = (lat: number, lon: number, km = 5) => ownFeed("/api/cameras", lat, lon, km);
/** Live bus and train positions from the configured GTFS-realtime feeds. */
export const transitVehicles = (lat: number, lon: number, km = 4) => ownFeed("/api/transit", lat, lon, km);
