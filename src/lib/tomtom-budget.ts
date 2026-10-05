/**
 * Daily TomTom non-tile budget. Free tier is ~2,500 requests/day across Search,
 * Routing, and Traffic (tiles are a separate 50k). Search stops near 1,500 so
 * Routing + incidents still have room. The counter is an approximation — Cache
 * API can drop entries — and never invents a result when the cap is hit.
 *
 * Terms (developer.tomtom.com/terms, 2026): cache only for the Cache-Control
 * max-age on the response; do not keep a search/routing database or scale one
 * upstream answer across users for longer than that. Search TTL is hours-max;
 * routing is seconds.
 */
export const TOMTOM_ATTRIBUTION = "© TomTom";
export const TOMTOM_SEARCH_DAILY = 1500;
export const TOMTOM_TOTAL_DAILY = 2500;
export const SEARCH_TTL_SEC = 1800;
export const ROUTE_TTL_SEC = 15;
export const INCIDENT_TTL_SEC = 45;

export type TomTomSpend = "search" | "route" | "incidents" | "other";

export type TomTomBudget = {
  day: string;
  search: number;
  route: number;
  incidents: number;
  other: number;
};

export type BudgetStore = {
  get(): Promise<TomTomBudget | null>;
  set(b: TomTomBudget): Promise<void>;
};

export function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function emptyBudget(day: string): TomTomBudget {
  return { day, search: 0, route: 0, incidents: 0, other: 0 };
}

export function budgetTotal(b: TomTomBudget): number {
  return b.search + b.route + b.incidents + b.other;
}

export function canSpend(b: TomTomBudget, kind: TomTomSpend): boolean {
  if (budgetTotal(b) >= TOMTOM_TOTAL_DAILY) return false;
  if (kind === "search" && b.search >= TOMTOM_SEARCH_DAILY) return false;
  return true;
}

export function spend(b: TomTomBudget, kind: TomTomSpend, n = 1): TomTomBudget {
  return { ...b, [kind]: b[kind] + n };
}

export function remaining(b: TomTomBudget): { search: number; total: number } {
  return {
    search: Math.max(0, TOMTOM_SEARCH_DAILY - b.search),
    total: Math.max(0, TOMTOM_TOTAL_DAILY - budgetTotal(b)),
  };
}

/** Reserve one call. Null means skip TomTom and use the free fallback. */
export async function reserve(
  store: BudgetStore,
  kind: TomTomSpend,
  now = Date.now(),
): Promise<TomTomBudget | null> {
  const day = utcDay(now);
  const raw = await store.get();
  const b = raw && raw.day === day ? raw : emptyBudget(day);
  if (!canSpend(b, kind)) return null;
  const next = spend(b, kind);
  await store.set(next);
  return next;
}

export function edgeCache(): Cache | null {
  try {
    const bag = caches as unknown as { default?: Cache };
    return bag.default ?? null;
  } catch {
    return null;
  }
}

export function cacheBudgetStore(cache: Cache, waitUntil: (p: Promise<unknown>) => void): BudgetStore {
  const key = new Request("https://slide-cache.invalid/tomtom/budget");
  return {
    async get() {
      const res = await cache.match(key);
      if (!res) return null;
      try {
        return (await res.json()) as TomTomBudget;
      } catch {
        return null;
      }
    },
    async set(b) {
      const res = new Response(JSON.stringify(b), {
        headers: { "content-type": "application/json", "cache-control": "max-age=172800" },
      });
      waitUntil(cache.put(key, res));
    },
  };
}

export function memoryBudgetStore(seed?: TomTomBudget): BudgetStore {
  let cur = seed ?? null;
  return {
    async get() {
      return cur;
    },
    async set(b) {
      cur = b;
    },
  };
}
