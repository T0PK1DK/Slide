import { collectTrips, sameTrip, type RouteResponse, type RouteVariant, type ValhallaTrip } from "../lib/valhalla";

/** Most lines Slide draws at once. More than this stops being a choice and becomes noise. */
export const MAX_ROUTES = 4;

/**
 * Merge the answers from several variant requests into one list of distinct
 * trips, in request order (so the Slide-costed line comes first). A variant that
 * failed (network, 4xx) is skipped: any answer at all still plans a trip.
 */
export function mergeVariantTrips(
  results: Array<PromiseSettledResult<RouteResponse>>,
  max = MAX_ROUTES
): ValhallaTrip[] {
  const out: ValhallaTrip[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const trip of collectTrips(r.value)) {
      if (out.length >= max) return out;
      if (!out.some((seen) => sameTrip(seen, trip))) out.push(trip);
    }
  }
  return out;
}

/** Which variants to ask for. "No tolls" is pointless when the driver already avoids tolls everywhere. */
export function variantsFor(avoidTolls: boolean): RouteVariant[] {
  return avoidTolls ? ["slide", "fastest"] : ["slide", "fastest", "notolls"];
}

/** Bubble text for a route's tolls. `null` (server didn't say) shows nothing — never a guess. */
export function tollLabel(hasToll: boolean | null): string {
  if (hasToll === true) return "Has tolls";
  if (hasToll === false) return "No tolls";
  return "";
}

/**
 * Pure: candidate points for a route's bubble, best first — points on this line
 * farthest from every other line, so bubbles sit where the routes actually
 * differ instead of stacking on shared road. Mid-line is always a candidate.
 */
export function bubbleCandidates(
  line: Array<[number, number]>,
  others: Array<Array<[number, number]>>,
  k = 8
): Array<[number, number]> {
  if (!line.length) return [];
  const mid = line[Math.floor(line.length / 2)];
  if (!others.length) return [mid];
  const sample = <T,>(xs: T[], n: number) => xs.filter((_, i) => i % Math.max(1, Math.floor(xs.length / n)) === 0);
  const theirs = others.flatMap((o) => sample(o, 120));
  // Skip the first and last 10%: every route shares the start and the destination.
  const from = Math.floor(line.length * 0.1), to = Math.ceil(line.length * 0.9);
  const scored = sample(line.slice(from, to), 80).map((p) => {
    let d = Infinity;
    for (const q of theirs) {
      const dx = (p[0] - q[0]) * Math.cos((p[1] * Math.PI) / 180), dy = p[1] - q[1];
      d = Math.min(d, dx * dx + dy * dy);
    }
    return { p, d };
  });
  scored.sort((a, b) => b.d - a.d);
  return [...scored.slice(0, k).map((x) => x.p), mid];
}

/** Pure: first candidate (in screen px) whose box doesn't overlap any already-placed bubble. */
export function pickFree(
  candidates: Array<{ x: number; y: number }>,
  placed: Array<{ x: number; y: number }>,
  w = 104,
  h = 64
): number {
  const free = (c: { x: number; y: number }) => placed.every((q) => Math.abs(c.x - q.x) >= w || Math.abs(c.y - q.y) >= h);
  const i = candidates.findIndex(free);
  return i === -1 ? 0 : i;
}
