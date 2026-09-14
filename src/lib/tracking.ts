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

export type TrackerHandle = { stop: () => void };

/**
 * Live GPS. `coords.speed` is metres/second and is null on plenty of devices,
 * so fall back to distance/time between fixes rather than showing nothing.
 */
export function startTracking(
  onFix: (fix: Fix) => void,
  onError: (message: string) => void
): TrackerHandle {
  if (!navigator.geolocation) {
    onError("Location unavailable on this device.");
    return { stop: () => {} };
  }
  let prev: { lon: number; lat: number; at: number } | null = null;

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

      onFix({
        pos: { lon, lat },
        speedMph: Number.isFinite(mph) ? Math.max(0, Math.min(160, mph)) : 0,
        headingDeg: pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null,
        accuracyM: pos.coords.accuracy ?? 0,
        at,
      });
    },
    (err) => {
      onError(
        err.code === err.PERMISSION_DENIED
          ? "Location permission denied."
          : "Waiting on a GPS fix."
      );
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
  );

  return { stop: () => navigator.geolocation.clearWatch(id) };
}
