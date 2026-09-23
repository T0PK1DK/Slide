import type { LonLat } from "./valhalla";
import type { SlideRoute } from "./smooth";

export type CachedPlan = {
  origin: LonLat;
  dest: LonLat;
  originLabel: string;
  destLabel: string;
  routes: SlideRoute[];
};

let lastPlan: CachedPlan | null = null;
let lastStyle: object | null = null;

function near(a: LonLat, b: LonLat): boolean {
  return Math.abs(a.lon - b.lon) < 1e-5 && Math.abs(a.lat - b.lat) < 1e-5;
}

export function cachePlan(plan: CachedPlan): void {
  lastPlan = plan;
}

export function getCachedPlan(origin: LonLat, dest: LonLat): CachedPlan | null {
  if (!lastPlan) return null;
  if (near(lastPlan.origin, origin) && near(lastPlan.dest, dest)) return lastPlan;
  return null;
}

export function cacheStyle(style: object): void {
  lastStyle = style;
}

export function getCachedStyle(): object | null {
  return lastStyle;
}
