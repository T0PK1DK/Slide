import { describe, expect, it } from "vitest";
import { TEST_USER_ID } from "./auth-config";
import {
  MAX_BATCH,
  SYNC_QUEUE_KEY,
  createDriveHistorySync,
  loadSyncQueue,
  saveSyncQueue,
  syncStatusLabel,
  tripProblem,
  tripToRow,
  type DriveHistoryRow,
  type SyncDeps,
  type SyncStore,
} from "./drive-history-sync";
import type { TripRecord } from "./history";

function trip(over: Partial<TripRecord> = {}): TripRecord {
  return {
    id: "t1729000000000",
    startedAt: 1_729_000_000_000,
    endedAt: 1_729_000_840_000,
    destLabel: "Work",
    routeLabel: "Slide",
    distanceMi: 6.2,
    plannedSec: 800,
    actualSec: 840,
    slideScore: 82,
    lefts: 3,
    offRouteEvents: 0,
    postedProfile: [45, 35, 30],
    tollRoad: false,
    ...over,
  };
}

function mem(): SyncStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

function harness(over: Partial<{
  owner: string | null;
  cloud: boolean;
  online: boolean;
  trips: TripRecord[];
  rpc: (rows: DriveHistoryRow[]) => Promise<number>;
}> = {}) {
  const store = mem();
  const calls: DriveHistoryRow[][] = [];
  let online = over.online ?? true;
  const timers: Array<{ id: number; fn: () => void; ms: number }> = [];
  let nextTimer = 1;
  const trips = over.trips ?? [];
  const rpc =
    over.rpc ??
    (async (rows: DriveHistoryRow[]) => {
      calls.push(rows);
      return rows.length;
    });
  const deps: SyncDeps = {
    store,
    loadTrips: () => trips.slice(),
    owner: () => (over.owner === undefined ? TEST_USER_ID : over.owner),
    cloudReady: () => over.cloud ?? true,
    rpc: async (rows) => rpc(rows),
    online: () => online,
    setTimeout: (fn, ms) => {
      const id = nextTimer++;
      timers.push({ id, fn, ms });
      return id;
    },
    clearTimeout: (id) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  };
  const sync = createDriveHistorySync(deps);
  return {
    sync,
    store,
    calls,
    timers,
    setOnline: (v: boolean) => {
      online = v;
    },
    runTimers: async () => {
      const due = timers.splice(0, timers.length);
      for (const t of due) t.fn();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe("trip → row", () => {
  it("maps the history model onto the drive_history columns", () => {
    const row = tripToRow(trip());
    expect(row).toEqual({
      id: "t1729000000000",
      profile_id: TEST_USER_ID,
      started_at: new Date(1_729_000_000_000).toISOString(),
      ended_at: new Date(1_729_000_840_000).toISOString(),
      distance_mi: 6.2,
      duration_sec: 840,
      dest_label: "Work",
      route_label: "Slide",
      summary: {
        destLabel: "Work",
        routeLabel: "Slide",
        plannedSec: 800,
        slideScore: 82,
        lefts: 3,
        offRouteEvents: 0,
        postedProfile: [45, 35, 30],
        tollRoad: false,
      },
    });
  });

  it("rejects junk before it hits the wire", () => {
    expect(tripProblem(trip({ id: "" }))).toBe("bad id");
    expect(tripProblem(trip({ id: "no spaces allowed" }))).toBe("bad id");
    expect(tripProblem(trip({ endedAt: 1 }))).toBe("bad times");
    expect(tripProblem(trip({ distanceMi: -1 }))).toBe("bad distance");
    expect(tripProblem(trip({ actualSec: 9999999 }))).toBe("bad duration");
    expect(tripProblem(trip({ routeLabel: "Teleport" as TripRecord["routeLabel"] }))).toBe("bad route");
    expect(tripProblem(trip())).toBeNull();
  });

  it("always stamps the built-in test profile id", () => {
    expect(tripToRow(trip(), "someone-else").profile_id).toBe("someone-else");
    expect(tripToRow(trip()).profile_id).toBe(TEST_USER_ID);
  });
});

describe("sync queue + flush", () => {
  it("upserts by trip id and is idempotent after a success", async () => {
    const t = trip();
    const h = harness({ trips: [t] });
    h.sync.noteTrip(t);
    await h.runTimers();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0][0].id).toBe(t.id);
    h.sync.noteTrip(t);
    await h.runTimers();
    expect(h.calls).toHaveLength(1);
    const q = loadSyncQueue(h.store);
    expect(q.pending).toEqual([]);
    expect(q.synced).toEqual([t.id]);
    expect(h.sync.status().state).toBe("synced");
    expect(h.sync.status().label).toMatch(/up to date/i);
  });

  it("retries when the RPC fails and does not drop the trip", async () => {
    const t = trip();
    let fails = 1;
    const h = harness({
      trips: [t],
      rpc: async (rows) => {
        if (fails > 0) {
          fails -= 1;
          throw new Error("offline");
        }
        return rows.length;
      },
    });
    h.sync.noteTrip(t);
    await h.runTimers();
    expect(h.sync.status().state).toBe("retry");
    expect(loadSyncQueue(h.store).pending).toEqual([t.id]);
    await h.runTimers();
    expect(loadSyncQueue(h.store).synced).toEqual([t.id]);
    expect(h.sync.status().state).toBe("synced");
  });

  it("waits when the phone is offline and never throws", async () => {
    const t = trip();
    const h = harness({ trips: [t], online: false });
    expect(() => h.sync.noteTrip(t)).not.toThrow();
    await h.runTimers();
    expect(h.calls).toHaveLength(0);
    expect(h.sync.status().state).toBe("offline");
    expect(h.sync.status().label).toMatch(/connection/i);
  });

  it("does not send another driver's trips", async () => {
    const t = trip();
    const h = harness({ trips: [t], owner: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1" });
    h.sync.noteTrip(t);
    h.sync.start();
    await h.runTimers();
    expect(h.calls).toHaveLength(0);
  });

  it("does nothing when Supabase is not configured", async () => {
    const t = trip();
    const h = harness({ trips: [t], cloud: false });
    h.sync.noteTrip(t);
    await h.runTimers();
    expect(h.calls).toHaveLength(0);
    expect(h.sync.status().label).toMatch(/off on this build/i);
  });

  it("seeds unsynced local trips on start", async () => {
    const a = trip({ id: "t1" });
    const b = trip({ id: "t2", startedAt: 2, endedAt: 3 });
    const store = mem();
    saveSyncQueue(store, { pending: [], synced: ["t1"] });
    const calls: DriveHistoryRow[][] = [];
    const timers: Array<{ fn: () => void }> = [];
    const sync = createDriveHistorySync({
      store,
      loadTrips: () => [a, b],
      owner: () => TEST_USER_ID,
      cloudReady: () => true,
      rpc: async (rows) => {
        calls.push(rows);
        return rows.length;
      },
      online: () => true,
      setTimeout: (fn) => {
        timers.push({ fn });
        return timers.length;
      },
      clearTimeout: () => {},
    });
    sync.start();
    for (const t of timers.splice(0)) t.fn();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls[0].map((r) => r.id)).toEqual(["t2"]);
  });

  it("caps a flush at MAX_BATCH and continues", async () => {
    const trips = Array.from({ length: MAX_BATCH + 2 }, (_, i) => trip({ id: `t${i}`, startedAt: i, endedAt: i + 1 }));
    const h = harness({ trips });
    h.sync.start();
    await h.runTimers();
    expect(h.calls[0]).toHaveLength(MAX_BATCH);
    await h.runTimers();
    expect(h.calls[1]).toHaveLength(2);
  });
});

describe("status copy", () => {
  it("explains pending / synced / offline without sounding like a login error", () => {
    expect(syncStatusLabel({ state: "idle", pending: 0, synced: 0 }, false)).toMatch(/off on this build/);
    expect(syncStatusLabel({ state: "pending", pending: 2, synced: 0 }, true)).toMatch(/2 drives waiting/);
    expect(syncStatusLabel({ state: "offline", pending: 1, synced: 0 }, true)).toMatch(/connection/);
    expect(syncStatusLabel({ state: "synced", pending: 0, synced: 4 }, true)).toMatch(/up to date/);
    expect(syncStatusLabel({ state: "syncing", pending: 1, synced: 0 }, true)).toMatch(/sending 1 drive/);
  });
});

describe("queue persist", () => {
  it("round-trips pending + synced under the sync key", () => {
    const store = mem();
    saveSyncQueue(store, { pending: ["a", "a"], synced: ["b"] });
    expect(store.data[SYNC_QUEUE_KEY]).toBeTruthy();
    expect(loadSyncQueue(store)).toEqual({ pending: ["a"], synced: ["b"] });
  });
});
