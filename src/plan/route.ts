import {
  collectTrips,
  requestFastRoute,
  requestRoutes,
  requestTraceAttributes,
  sameTrip,
  tripShape,
  type LonLat,
} from "../lib/valhalla";
import { rankRoutes, scoreTrip, type SlideRoute } from "../lib/smooth";
import { cachePlan, getCachedPlan } from "../lib/sessionCache";
import { netMessage } from "../lib/net";

export type PlanResult = {
  routes: SlideRoute[];
  selectedId: string;
};

export async function planRoutes(
  origin: LonLat,
  dest: LonLat,
  originLabel: string,
  destLabel: string
): Promise<PlanResult> {
  const hit = getCachedPlan(origin, dest);
  if (hit) return { routes: hit.routes, selectedId: hit.routes[0]?.id ?? "" };

  const raw = await requestRoutes(origin, dest);
  let trips = collectTrips(raw);
  if (!trips.length) throw new Error("No route for that pair. Try a nearby street.");
  if (trips.length < 2) {
    try {
      const fast = collectTrips(await requestFastRoute(origin, dest, "miles"));
      trips = trips.concat(fast.filter((t) => !trips.some((seen) => sameTrip(seen, t))).slice(0, 1));
    } catch {
      // One good line still answers the question.
    }
  }
  const scored = [];
  for (const trip of trips) {
    const attrs = await requestTraceAttributes(tripShape(trip));
    scored.push(scoreTrip(trip, attrs.edges ?? [], "miles"));
  }
  const routes = rankRoutes(scored);
  if (!routes.length) throw new Error("No route for that pair. Try a nearby street.");
  cachePlan({ origin, dest, originLabel, destLabel, routes });
  return { routes, selectedId: routes[0]?.id ?? "" };
}

export function planErrorMessage(err: unknown): string {
  if (err instanceof Error && /no route/i.test(err.message)) return err.message;
  return netMessage(err, "Routing failed.");
}
