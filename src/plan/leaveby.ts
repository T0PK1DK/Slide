import { formatDuration, leaveByForTarget } from "../lib/smooth";
import { decodePolyline6 } from "../lib/polyline";
import { fetchTrafficRoute, type RoutePoint } from "../lib/tomtom-route";
import { offerFromTraffic, RouteBrain, routeKey } from "../lib/route-brain";
import { tripShape, type ValhallaTrip } from "../lib/valhalla";

export const LEAVE_BUFFER_SEC = 180;

export type LeaveByDuration = { durationSec: number; live: boolean };

/** Valhalla typical, then TomTom Routing through the same route-brain rules as plan/drive. */
export async function resolveLeaveByDuration(
  trip: ValhallaTrip,
  summary: { time: number; length: number },
  trafficEnabled: boolean,
  signal?: AbortSignal,
): Promise<LeaveByDuration> {
  const baselineSec = Math.round(summary.time);
  const distanceMi = summary.length;
  const coords = decodePolyline6(tripShape(trip));
  const key = routeKey("leaveby", coords, distanceMi);
  const brain = new RouteBrain({ minIntervalMs: 0 });
  brain.setRoute({ key, distanceMi, baselineSec, coords });
  if (trafficEnabled && coords.length >= 2) {
    const points: RoutePoint[] = [coords[0], coords[coords.length - 1]].map(([lon, lat]) => ({ lon, lat }));
    const rt = await fetchTrafficRoute({ points, signal });
    if (rt) {
      const offer = offerFromTraffic(
        { source: "routing", delaySec: rt.trafficDelaySec, travelTimeSec: rt.travelTimeSec, lengthMeters: rt.lengthMeters },
        key,
        baselineSec,
        distanceMi,
      );
      if (offer) brain.offer(offer);
    }
  }
  const snap = brain.snapshot();
  return { durationSec: snap.totalSec, live: snap.live };
}

/** Today's clock `HH:MM` → a Date. If that time already passed, use tomorrow. */
export function arrivalTarget(hhmm: string, now = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const target = new Date(now);
  target.setHours(h, min, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

export type LeaveByResult = {
  depart: Date;
  late: boolean;
  headline: string;
  note: string;
};

/**
 * Pure: typical Valhalla duration + 3 min buffer → "Leave by X".
 * `incidentCount` is mentioned only when we actually have incidents (never a
 * made-up delay).
 */
export function leaveByCopy(
  durationSec: number,
  target: Date,
  now = new Date(),
  incidentCount: number | null = null,
  live = false,
): LeaveByResult {
  const depart = leaveByForTarget(durationSec, target, LEAVE_BUFFER_SEC);
  const late = depart.getTime() <= now.getTime();
  const time = depart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const headline = late
    ? live
      ? "Leave now — that arrival is already behind live traffic."
      : "Leave now — that arrival is already behind the typical time."
    : `Leave by ${time}`;
  const bits = [
    live ? `Live ${formatDuration(durationSec)}` : `Typical ${formatDuration(durationSec)}`,
    "3 min buffer",
    live ? "live traffic" : "no live traffic",
  ];
  if (incidentCount != null && incidentCount > 0) {
    bits.push(
      `${incidentCount} official incident${incidentCount === 1 ? "" : "s"} near you (not added to the time)`
    );
  }
  return { depart, late, headline, note: bits.join(" · ") };
}
