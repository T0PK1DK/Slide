import { formatDuration, leaveByForTarget } from "../lib/smooth";

export const LEAVE_BUFFER_SEC = 180;

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
  incidentCount: number | null = null
): LeaveByResult {
  const depart = leaveByForTarget(durationSec, target, LEAVE_BUFFER_SEC);
  const late = depart.getTime() <= now.getTime();
  const time = depart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const headline = late
    ? "Leave now — that arrival is already behind the typical time."
    : `Leave by ${time}`;
  const bits = [
    `Typical ${formatDuration(durationSec)}`,
    "3 min buffer",
    "no live traffic",
  ];
  if (incidentCount != null && incidentCount > 0) {
    bits.push(
      `${incidentCount} official incident${incidentCount === 1 ? "" : "s"} near you (not added to the time)`
    );
  }
  return { depart, late, headline, note: bits.join(" · ") };
}
