import { haversineMeters } from "./polyline";
import type { LonLat } from "./valhalla";

const METERS_PER_MILE = 1609.344;
const MPS_TO_MPH = 2.2369362920544;

export type Fix = {
  pos: LonLat;
  /** mph, already clamped to something a car can do. */
  speedMph: number;
  headingDeg: number | null;
  accuracyM: number;
  at: number;
};

export type RouteProgress = {
  /** Index of the shape vertex just behind the driver. */
  index: number;
  /** Snapped position on the line. */
  snapped: LonLat;
  /** Distance travelled along the route, miles. */
  alongMi: number;
  /** How far the raw fix sits off the line, metres. */
  offRouteM: number;
  bearing: number;
};

/** Cumulative distance to each vertex, so progress is a lookup not a scan. */
export function cumulativeMiles(coords: [number, number][]): number[] {
  const out = new Array<number>(coords.length);
  let total = 0;
  out[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    out[i] = total / METERS_PER_MILE;
  }
  return out;
}

function projectOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { point: [number, number]; t: number } {
  // Flat-earth projection is fine at segment scale (tens of metres).
  const latScale = Math.cos((a[1] * Math.PI) / 180);
  const ax = a[0] * latScale, ay = a[1];
  const bx = b[0] * latScale, by = b[1];
  const px = p[0] * latScale, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { point: a, t: 0 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t };
}

function bearingBetween(a: [number, number], b: [number, number]): number {
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Snap a GPS fix onto the planned line. This is deliberately a nearest-segment
 * projection, not full map matching — it is honest about being an approximation
 * and stays cheap enough to run on every fix.
 */
export function snapToRoute(
  coords: [number, number][],
  cumulative: number[],
  fix: LonLat,
  searchFrom = 0
): RouteProgress | null {
  if (coords.length < 2) return null;
  const p: [number, number] = [fix.lon, fix.lat];
  let best = { d: Infinity, i: 0, t: 0, point: coords[0] as [number, number] };
  for (let i = Math.max(0, searchFrom); i < coords.length - 1; i++) {
    const { point, t } = projectOnSegment(p, coords[i], coords[i + 1]);
    const d = haversineMeters(p[0], p[1], point[0], point[1]);
    if (d < best.d) best = { d, i, t, point };
  }
  const segMi = (cumulative[best.i + 1] ?? cumulative[best.i]) - cumulative[best.i];
  return {
    index: best.i,
    snapped: { lon: best.point[0], lat: best.point[1] },
    alongMi: cumulative[best.i] + segMi * best.t,
    offRouteM: best.d,
    bearing: bearingBetween(coords[best.i], coords[best.i + 1]),
  };
}

/** Smallest angle between two bearings, degrees (0–180). */
export function bearingDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export type SnapInput = {
  pos: LonLat;
  /** Direction of travel, or null when the phone doesn't know. */
  headingDeg: number | null;
  speedMph: number;
};

/** How far ahead of the last known spot a fix may land (miles), before speed. */
const AHEAD_MI = 0.35;
/** How far behind (jitter, a missed fix while stopped) a fix may land, miles. */
const BEHIND_MI = 0.08;
/** A segment heading the other way costs this much, metres (overpasses, the other carriageway). */
const WRONG_WAY_PENALTY_M = 90;
/** Beyond this, the windowed match is lost and a whole-line search may take over. */
const WINDOW_LOST_M = 120;

/**
 * Keeps the driver on *their* stretch of the line. A plain nearest-segment snap
 * jumps to whatever piece of the route is closest: the causeway running back
 * the other way, the ramp under an overpass, a street the route uses twice.
 * Progress then leaps ahead or back and the ETA and next turn leap with it.
 *
 * This searches a window around the last match (a little behind, further ahead
 * at speed), penalises segments pointing against the direction of travel, and
 * only falls back to a whole-line search when the window has clearly lost the
 * driver (a reroute, a GPS dropout, starting mid-route).
 */
export class RouteSnapper {
  private last = -1;
  constructor(private readonly coords: [number, number][], private readonly cumulative: number[]) {}

  reset(): void {
    this.last = -1;
  }

  snap(input: SnapInput): RouteProgress | null {
    const { coords, cumulative } = this;
    if (coords.length < 2) return null;
    const moving = input.speedMph >= 5 && input.headingDeg !== null;
    const heading = moving ? input.headingDeg : null;
    if (this.last < 0) return this.commit(this.search(input.pos, heading, 0, coords.length - 2));

    const here = cumulative[this.last];
    // Allow roughly 15 s of travel at the current speed on top of the base window.
    const aheadMi = AHEAD_MI + (Math.max(0, input.speedMph) / 3600) * 15;
    let lo = this.last;
    while (lo > 0 && here - cumulative[lo] < BEHIND_MI) lo--;
    let hi = this.last;
    while (hi < coords.length - 2 && cumulative[hi] - here < aheadMi) hi++;

    const local = this.search(input.pos, heading, lo, hi);
    const localWrongWay = Boolean(local && heading !== null && bearingDiff(local.bearing, heading) > 100);
    if (local && local.offRouteM <= WINDOW_LOST_M && !localWrongWay) return this.commit(local);
    const global = this.search(input.pos, heading, 0, coords.length - 2);
    // Only jump to another part of the line when it's clearly where the driver is
    // (much closer, or the window's match points against the direction of travel).
    if (global && (!local || global.score < local.score - 40)) return this.commit(global);
    return local ? this.commit(local) : null;
  }

  private commit(p: (RouteProgress & { score: number }) | null): RouteProgress | null {
    if (!p) return null;
    this.last = p.index;
    const { score: _score, ...out } = p;
    return out;
  }

  private search(fix: LonLat, heading: number | null, from: number, to: number): (RouteProgress & { score: number }) | null {
    const { coords, cumulative } = this;
    const p: [number, number] = [fix.lon, fix.lat];
    let best: (RouteProgress & { score: number }) | null = null;
    for (let i = Math.max(0, from); i <= Math.min(to, coords.length - 2); i++) {
      const { point, t } = projectOnSegment(p, coords[i], coords[i + 1]);
      const d = haversineMeters(p[0], p[1], point[0], point[1]);
      const bearing = bearingBetween(coords[i], coords[i + 1]);
      const score = d + (heading !== null && bearingDiff(bearing, heading) > 100 ? WRONG_WAY_PENALTY_M : 0);
      if (!best || score < best.score) {
        const segMi = (cumulative[i + 1] ?? cumulative[i]) - cumulative[i];
        best = { index: i, snapped: { lon: point[0], lat: point[1] }, alongMi: cumulative[i] + segMi * t, offRouteM: d, bearing, score };
      }
    }
    return best;
  }
}

/**
 * Off-route distance that respects how good the fix is: a 60 m line is right
 * for a 10 m fix and wrong for a 70 m one (Brickell towers, parking garages).
 */
export function offRouteLimitM(accuracyM: number, base = 60): number {
  const acc = Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 0;
  return Math.max(base, Math.min(150, acc * 1.5));
}

/** Fixes worse than this are too vague to decide "off route" from; hold the last decision. */
export const UNUSABLE_ACCURACY_M = 200;

export type TrackerHandle = { stop: () => void };

/** Why there is no fix. Each gets its own message; none of them fall back to a fake position. */
export type LocationProblem = "denied" | "unavailable" | "timeout" | "insecure";

export const LOCATION_TITLES: Record<LocationProblem, string> = {
  denied: "Location is off",
  unavailable: "Can't find you",
  timeout: "Still looking",
  insecure: "Needs a secure page",
};

export const LOCATION_MESSAGES: Record<LocationProblem, string> = {
  denied: "Location is off for Slide. Allow it in your browser or phone settings (Settings → Privacy → Location), then tap Try again.",
  unavailable: "Your phone can't find its location right now. Check that Location Services are on, or search a start point instead.",
  timeout: "Still waiting on a GPS fix. Move somewhere with a clear view of the sky, or search a start point instead.",
  insecure: "Location needs a secure (https) page. Open Slide from kings-slide.pages.dev, or search a start point instead.",
};

/**
 * Live GPS. `coords.speed` is metres/second and is null on plenty of devices,
 * so fall back to distance/time between fixes rather than showing nothing.
 */
export function startTracking(
  onFix: (fix: Fix) => void,
  onError: (problem: LocationProblem) => void
): TrackerHandle {
  if (!window.isSecureContext) {
    onError("insecure");
    return { stop: () => {} };
  }
  if (!navigator.geolocation) {
    onError("unavailable");
    return { stop: () => {} };
  }
  let prev: { lon: number; lat: number; at: number } | null = null;
  // Last point the course was measured from, and the smoothed speed.
  let courseFrom: { lon: number; lat: number } | null = null;
  let course: number | null = null;
  let smoothMph: number | null = null;

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const at = pos.timestamp || Date.now();
      const { longitude: lon, latitude: lat } = pos.coords;
      let mph = pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed * MPS_TO_MPH : NaN;

      if (!Number.isFinite(mph) && prev) {
        const dt = (at - prev.at) / 1000;
        if (dt > 0.4) {
          const meters = haversineMeters(prev.lon, prev.lat, lon, lat);
          mph = (meters / dt) * MPS_TO_MPH;
        }
      }
      prev = { lon, lat, at };

      // Many phones (Safari, most Android browsers) send no heading. Measure the
      // course from movement instead, once the car has moved far enough that
      // GPS wobble can't fake a direction.
      if (!courseFrom) courseFrom = { lon, lat };
      else if (haversineMeters(courseFrom.lon, courseFrom.lat, lon, lat) >= 12) {
        course = bearingBetween([courseFrom.lon, courseFrom.lat], [lon, lat]);
        courseFrom = { lon, lat };
      }
      const raw = Number.isFinite(mph) ? Math.max(0, Math.min(160, mph)) : 0;
      // Light smoothing so the speedo and the snapper don't twitch on one noisy fix.
      smoothMph = smoothMph === null ? raw : smoothMph * 0.35 + raw * 0.65;
      const speedMph = smoothMph < 1 ? 0 : smoothMph;
      const reported = pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null;

      onFix({
        pos: { lon, lat },
        speedMph,
        headingDeg: reported ?? (speedMph >= 4 ? course : null),
        accuracyM: pos.coords.accuracy ?? 0,
        at,
      });
    },
    (err) => {
      // A watch keeps running after TIMEOUT / POSITION_UNAVAILABLE; only a denial ends it.
      onError(
        err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable"
      );
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
  );

  return { stop: () => navigator.geolocation.clearWatch(id) };
}
