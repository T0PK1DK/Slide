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
  /** Valhalla said the driven line had tolls. Absent on older trips / unknown. */
  tollRoad?: boolean | null;
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

export type Tile = { value: number | null; delta: number | null };
export type WeekTiles = { avgTripMin: Tile; miles: Tile; tollTrips: Tile; onTime: Tile };

/**
 * Pure: the desktop stat tiles — this 7 days vs the 7 before, from recorded
 * trips only. `null` means "no trips to say anything", shown as an em dash.
 */
export function weekTiles(all: TripRecord[], now = Date.now()): WeekTiles {
  const WEEK = 7 * 864e5;
  const cur = all.filter((t) => now - t.startedAt <= WEEK);
  const prev = all.filter((t) => now - t.startedAt > WEEK && now - t.startedAt <= 2 * WEEK);
  const avgMin = (xs: TripRecord[]) => (xs.length ? xs.reduce((a, t) => a + t.actualSec, 0) / xs.length / 60 : null);
  const miles = (xs: TripRecord[]) => xs.reduce((a, t) => a + t.distanceMi, 0);
  const tolls = (xs: TripRecord[]) => xs.filter((t) => t.tollRoad === true).length;
  const onTime = (xs: TripRecord[]) =>
    xs.length ? (100 * xs.filter((t) => Math.abs(t.actualSec - t.plannedSec) <= Math.max(120, t.plannedSec * 0.1)).length) / xs.length : null;
  const tile = (c: number | null, p: number | null, hasPrev: boolean): Tile => ({
    value: c,
    delta: c !== null && p !== null && hasPrev ? c - p : null,
  });
  const hp = prev.length > 0;
  return {
    avgTripMin: tile(avgMin(cur), avgMin(prev), hp),
    miles: tile(cur.length ? miles(cur) : null, miles(prev), hp),
    tollTrips: tile(cur.length ? tolls(cur) : null, tolls(prev), hp),
    onTime: tile(onTime(cur), onTime(prev), hp),
  };
}

/** Pure: minutes driven on each of the last 7 days, oldest first (index 6 = today). */
export function minutesByDay(all: TripRecord[], now = Date.now()): number[] {
  const out = new Array<number>(7).fill(0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (const t of all) {
    const day = new Date(t.startedAt);
    day.setHours(0, 0, 0, 0);
    const ago = Math.round((today.getTime() - day.getTime()) / 864e5);
    if (ago >= 0 && ago < 7) out[6 - ago] += t.actualSec / 60;
  }
  return out.map((m) => Math.round(m));
}
