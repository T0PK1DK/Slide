import { accountOwner } from "./account-store";
import { TEST_USER_ID } from "./auth-config";
import { cloud, cloudConfigured } from "./cloud";
import { loadTrips, type TripRecord } from "./history";

/**
 * Best-effort mirror of the test driver's on-device commute history to
 * public.drive_history. localStorage stays the source of truth. Never throws
 * into the UI. See docs/TEST_ACCOUNT_DATA.md.
 */

export const DRIVE_HISTORY_TABLE = "drive_history";
export const DRIVE_HISTORY_VIEW = "drive_history_test";
export const UPSERT_RPC = "upsert_test_drive_history";
export const SYNC_QUEUE_KEY = "slide.history.sync.v1";
export const MAX_BATCH = 20;
export const MAX_POSTED = 32;
export const MAX_DEST = 120;
export const MAX_TRIP_JSON = 8000;

export const ROUTE_LABELS = ["Slide", "Faster", "Alt"] as const;
export type RouteLabel = (typeof ROUTE_LABELS)[number];

export type DriveHistorySummary = {
  destLabel: string;
  routeLabel: RouteLabel;
  plannedSec: number;
  slideScore: number;
  lefts: number;
  offRouteEvents: number;
  postedProfile: number[];
  tollRoad: boolean | null;
};

export type DriveHistoryRow = {
  id: string;
  profile_id: string;
  started_at: string;
  ended_at: string;
  distance_mi: number;
  duration_sec: number;
  dest_label: string;
  route_label: RouteLabel;
  summary: DriveHistorySummary;
};

export type SyncState = "idle" | "pending" | "syncing" | "synced" | "offline" | "retry";

export type SyncStatus = {
  state: SyncState;
  pending: number;
  synced: number;
  label: string;
};

export type SyncQueue = { pending: string[]; synced: string[] };

export type SyncStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type SyncRpc = (trips: DriveHistoryRow[]) => Promise<number>;

export type SyncDeps = {
  store: SyncStore;
  loadTrips: () => TripRecord[];
  owner: () => string | null;
  cloudReady: () => boolean;
  rpc: SyncRpc;
  online: () => boolean;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
};

const BACKOFF_MS = [2_000, 8_000, 32_000, 120_000];

function memStore(): SyncStore {
  return {
    getItem: (key) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* private / full */
      }
    },
  };
}

export function emptySyncQueue(): SyncQueue {
  return { pending: [], synced: [] };
}

export function loadSyncQueue(store: SyncStore): SyncQueue {
  try {
    const raw = store.getItem(SYNC_QUEUE_KEY);
    if (!raw) return emptySyncQueue();
    const parsed = JSON.parse(raw) as Partial<SyncQueue>;
    const pending = Array.isArray(parsed.pending) ? parsed.pending.filter((id) => typeof id === "string") : [];
    const synced = Array.isArray(parsed.synced) ? parsed.synced.filter((id) => typeof id === "string") : [];
    return { pending: uniq(pending), synced: uniq(synced) };
  } catch {
    return emptySyncQueue();
  }
}

export function saveSyncQueue(store: SyncStore, q: SyncQueue) {
  store.setItem(SYNC_QUEUE_KEY, JSON.stringify({ pending: uniq(q.pending), synced: uniq(q.synced).slice(0, 800) }));
}

function uniq(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function isRouteLabel(v: unknown): v is RouteLabel {
  return v === "Slide" || v === "Faster" || v === "Alt";
}

/** Pure: why a trip cannot be mirrored, or null if it is fine. */
export function tripProblem(trip: TripRecord): string | null {
  if (!trip || typeof trip.id !== "string" || !/^[A-Za-z0-9._:-]{1,80}$/.test(trip.id)) return "bad id";
  if (!Number.isFinite(trip.startedAt) || !Number.isFinite(trip.endedAt) || trip.endedAt < trip.startedAt) return "bad times";
  if (!Number.isFinite(trip.distanceMi) || trip.distanceMi < 0 || trip.distanceMi > 2000) return "bad distance";
  if (!Number.isFinite(trip.actualSec) || trip.actualSec < 0 || trip.actualSec > 604800) return "bad duration";
  if (!isRouteLabel(trip.routeLabel)) return "bad route";
  return null;
}

/** Pure: TripRecord → RPC row. Forces the built-in test profile id. */
export function tripToRow(trip: TripRecord, profileId = TEST_USER_ID): DriveHistoryRow {
  const dest = String(trip.destLabel ?? "").trim().slice(0, MAX_DEST);
  const posted = (Array.isArray(trip.postedProfile) ? trip.postedProfile : [])
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .slice(0, MAX_POSTED);
  const route: RouteLabel = isRouteLabel(trip.routeLabel) ? trip.routeLabel : "Slide";
  const summary: DriveHistorySummary = {
    destLabel: dest,
    routeLabel: route,
    plannedSec: Math.max(0, Math.round(trip.plannedSec || 0)),
    slideScore: Number.isFinite(trip.slideScore) ? trip.slideScore : 0,
    lefts: Math.max(0, Math.round(trip.lefts || 0)),
    offRouteEvents: Math.max(0, Math.round(trip.offRouteEvents || 0)),
    postedProfile: posted,
    tollRoad: trip.tollRoad === true ? true : trip.tollRoad === false ? false : null,
  };
  return {
    id: trip.id,
    profile_id: profileId,
    started_at: new Date(trip.startedAt).toISOString(),
    ended_at: new Date(trip.endedAt).toISOString(),
    distance_mi: Math.round(trip.distanceMi * 100) / 100,
    duration_sec: Math.round(trip.actualSec),
    dest_label: dest,
    route_label: route,
    summary,
  };
}

export function syncStatusLabel(s: Omit<SyncStatus, "label">, cloudOn: boolean): string {
  if (!cloudOn) return "Commute sync: off on this build";
  if (s.state === "syncing") return s.pending ? `Commute sync: sending ${s.pending} drive${s.pending === 1 ? "" : "s"}…` : "Commute sync: sending…";
  if (s.pending > 0 && s.state === "offline") {
    return `Commute sync: ${s.pending} drive${s.pending === 1 ? "" : "s"} waiting for a connection`;
  }
  if (s.pending > 0) return `Commute sync: ${s.pending} drive${s.pending === 1 ? "" : "s"} waiting · will retry`;
  if (s.synced > 0) return "Commute sync: up to date";
  return "Commute sync: nothing to send";
}

export function createDriveHistorySync(deps: SyncDeps) {
  let inflight = false;
  let timer = 0;
  let attempt = 0;
  let state: SyncState = "idle";
  const listeners = new Set<(s: SyncStatus) => void>();

  const read = () => loadSyncQueue(deps.store);

  const emit = (): SyncStatus => {
    const q = read();
    const status: SyncStatus = {
      state,
      pending: q.pending.length,
      synced: q.synced.length,
      label: syncStatusLabel({ state, pending: q.pending.length, synced: q.synced.length }, deps.cloudReady()),
    };
    for (const l of listeners) l(status);
    return status;
  };

  const canSync = () => deps.owner() === TEST_USER_ID && deps.cloudReady();

  const enqueue = (ids: string[]) => {
    const q = read();
    const incoming = ids.filter((id) => typeof id === "string" && id && !q.synced.includes(id) && !q.pending.includes(id));
    if (!incoming.length) return;
    q.pending.push(...incoming);
    saveSyncQueue(deps.store, q);
    if (state !== "syncing") state = deps.online() ? "pending" : "offline";
    emit();
  };

  const schedule = (ms?: number) => {
    deps.clearTimeout(timer);
    const wait = ms ?? 0;
    timer = deps.setTimeout(() => {
      void flush();
    }, wait);
  };

  const flush = async (): Promise<SyncStatus> => {
    if (inflight) return emit();
    if (!canSync()) {
      state = deps.cloudReady() ? "idle" : "idle";
      return emit();
    }
    if (!deps.online()) {
      state = read().pending.length ? "offline" : state;
      return emit();
    }
    const q = read();
    const trips = deps.loadTrips();
    const byId = new Map(trips.map((t) => [t.id, t]));
    const batchIds = q.pending.slice(0, MAX_BATCH);
    const rows: DriveHistoryRow[] = [];
    const skip: string[] = [];
    for (const id of batchIds) {
      const trip = byId.get(id);
      if (!trip || tripProblem(trip)) {
        skip.push(id);
        continue;
      }
      const row = tripToRow(trip, TEST_USER_ID);
      if (JSON.stringify(row).length > MAX_TRIP_JSON) {
        skip.push(id);
        continue;
      }
      rows.push(row);
    }
    if (skip.length) {
      q.pending = q.pending.filter((id) => !skip.includes(id));
      saveSyncQueue(deps.store, q);
    }
    if (!rows.length) {
      state = q.pending.length ? "pending" : q.synced.length ? "synced" : "idle";
      return emit();
    }
    inflight = true;
    state = "syncing";
    emit();
    try {
      await deps.rpc(rows);
      const next = loadSyncQueue(deps.store);
      const done = new Set(rows.map((r) => r.id));
      next.pending = next.pending.filter((id) => !done.has(id));
      next.synced = uniq([...next.synced, ...done]);
      saveSyncQueue(deps.store, next);
      attempt = 0;
      state = next.pending.length ? "pending" : "synced";
      if (next.pending.length) schedule(0);
    } catch {
      attempt += 1;
      state = deps.online() ? "retry" : "offline";
      schedule(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]);
    } finally {
      inflight = false;
    }
    return emit();
  };

  const seedFromLocal = () => {
    if (deps.owner() !== TEST_USER_ID) return;
    const trips = deps.loadTrips();
    const q = read();
    const known = new Set([...q.pending, ...q.synced]);
    enqueue(trips.map((t) => t.id).filter((id) => !known.has(id)));
  };

  return {
    noteTrip(trip: TripRecord) {
      if (deps.owner() !== TEST_USER_ID) return;
      if (tripProblem(trip)) return;
      enqueue([trip.id]);
      schedule(0);
    },
    start() {
      seedFromLocal();
      schedule(0);
    },
    flush,
    status: emit,
    subscribe(fn: (s: SyncStatus) => void) {
      listeners.add(fn);
      fn(emit());
      return () => listeners.delete(fn);
    },
  };
}

async function defaultRpc(trips: DriveHistoryRow[]): Promise<number> {
  const sb = await cloud();
  const { data, error } = await sb.rpc(UPSERT_RPC, { p_trips: trips });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : trips.length;
}

let singleton: ReturnType<typeof createDriveHistorySync> | null = null;

function defaultSync() {
  singleton ??= createDriveHistorySync({
    store: memStore(),
    loadTrips,
    owner: accountOwner,
    cloudReady: cloudConfigured,
    rpc: defaultRpc,
    online: () => (typeof navigator === "undefined" ? true : navigator.onLine !== false),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id) => window.clearTimeout(id),
  });
  return singleton;
}

/** After a local save: queue + flush. Never throws. */
export function noteLocalTrip(trip: TripRecord) {
  try {
    defaultSync().noteTrip(trip);
  } catch {
    /* never block the drive */
  }
}

/** Boot / online: enqueue anything not yet mirrored, then flush. Never throws. */
export function startDriveHistorySync() {
  try {
    const sync = defaultSync();
    sync.start();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        void sync.flush();
      });
    }
  } catch {
    /* ignore */
  }
}

export function driveHistoryStatus(): SyncStatus {
  try {
    return defaultSync().status();
  } catch {
    return { state: "idle", pending: 0, synced: 0, label: "Commute sync: nothing to send" };
  }
}

export function watchDriveHistoryStatus(fn: (s: SyncStatus) => void): () => void {
  try {
    return defaultSync().subscribe(fn);
  } catch {
    return () => {};
  }
}
