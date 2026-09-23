/**
 * On-device drive history — the only data the Command view charts. Every
 * number on those panels comes from drives this phone actually recorded with
 * live GPS; simulated/preview drives are never saved. Nothing leaves the device.
 */
export type TripRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  destLabel: string;
  routeLabel: "Slide" | "Faster" | "Alt";
  distanceMi: number;
  plannedSec: number;
  actualSec: number;
  slideScore: number;
  lefts: number;
  offRouteEvents: number;
  /** Posted limits sampled along the line (mph), for the row sparkline. */
  postedProfile: number[];
};

const KEY = "slide.history.v1";
const MAX_TRIPS = 400;

export function loadTrips(): TripRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as TripRecord[]) : [];
    return Array.isArray(list) ? list.filter((t) => typeof t?.startedAt === "number") : [];
  } catch {
    return [];
  }
}

export function recordTrip(trip: TripRecord) {
  const list = [trip, ...loadTrips()].slice(0, MAX_TRIPS);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: history is a nice-to-have, never block the drive.
  }
}

export type Window = "24h" | "7d" | "30d";
const WINDOW_MS: Record<Window, number> = { "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5 };

export function inWindow(trips: TripRecord[], w: Window, now = Date.now()): TripRecord[] {
  return trips.filter((t) => now - t.startedAt <= WINDOW_MS[w]);
}

export type Overview = {
  drives: number;
  alerts: number;
  smoothAvg: number | null;
  /** Change in smooth average vs the previous window of the same length, in points. */
  smoothDelta: number | null;
  /** Smooth score per trip, oldest first, for the trend chart. */
  trend: number[];
  /** Share of trips that arrived within 2 min or 10% of the planned time. */
  onTime: number | null;
  /** Drives started in each hour of the day (0–23). */
  byHour: number[];
  miles: number;
};

export function overview(all: TripRecord[], w: Window, now = Date.now()): Overview {
  const cur = inWindow(all, w, now);
  const prev = all.filter((t) => {
    const age = now - t.startedAt;
    return age > WINDOW_MS[w] && age <= 2 * WINDOW_MS[w];
  });
  const avg = (xs: TripRecord[]) => (xs.length ? xs.reduce((a, t) => a + t.slideScore, 0) / xs.length : null);
  const smoothAvg = avg(cur);
  const prevAvg = avg(prev);
  const onTimeTrips = cur.filter((t) => Math.abs(t.actualSec - t.plannedSec) <= Math.max(120, t.plannedSec * 0.1));
  const byHour = new Array<number>(24).fill(0);
  for (const t of cur) byHour[new Date(t.startedAt).getHours()] += 1;
  return {
    drives: cur.length,
    alerts: cur.reduce((a, t) => a + t.offRouteEvents, 0),
    smoothAvg,
    smoothDelta: smoothAvg !== null && prevAvg !== null ? smoothAvg - prevAvg : null,
    trend: [...cur].reverse().map((t) => t.slideScore),
    onTime: cur.length ? onTimeTrips.length / cur.length : null,
    byHour,
    miles: cur.reduce((a, t) => a + t.distanceMi, 0),
  };
}
