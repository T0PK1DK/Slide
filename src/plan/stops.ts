import { haversineMeters } from "../lib/polyline";

/** Most stops between start and destination. Keeps the plan readable and the request small. */
export const MAX_STOPS = 5;
/** Close enough to count a stop as visited while driving. */
export const STOP_REACHED_M = 60;

/** Pure: a copy of `list` with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item);
  return out;
}

/** Pure: how many stops from the front have been reached, given the driver's position. */
export function stopsReached(stops: ReadonlyArray<{ lon: number; lat: number }>, pos: { lon: number; lat: number }): number {
  // Only the next stop counts: passing near a later stop early doesn't skip the one before it.
  if (!stops.length) return 0;
  return haversineMeters(pos.lon, pos.lat, stops[0].lon, stops[0].lat) <= STOP_REACHED_M ? 1 : 0;
}

/** Pure: index a dragged row should land on, from the pointer's y and each row's vertical midpoint. */
export function dropIndex(pointerY: number, rowMids: readonly number[]): number {
  let i = 0;
  while (i < rowMids.length && pointerY > rowMids[i]) i++;
  return i;
}
