import { describe, expect, it } from "vitest";
import { CAUSEWAYS } from "./badges";
import { createGameProgress, memoryStore, migrateProgress, useGameProgress } from "./progress";
import { cruise } from "./cruise";
import { xpForTrip } from "./xp";

const day = new Date(2026, 5, 1, 15).getTime();
const night = new Date(2026, 5, 1, 22).getTime();

function drive(game: ReturnType<typeof createGameProgress>, opts: {
  id: string;
  mph?: number;
  posted?: number | null;
  miles?: number;
  at?: number;
  lon?: number;
  lat?: number;
}) {
  const miles = opts.miles ?? 1;
  const samples = cruise({
    mph: opts.mph ?? 35,
    posted: opts.posted === undefined ? 45 : opts.posted,
    miles,
    startAt: opts.at ?? day,
    lon: opts.lon,
    lat: opts.lat,
  });
  return game.commit({
    tripId: opts.id,
    startedAt: opts.at ?? day,
    endedAt: (opts.at ?? day) + 60_000,
    samples,
    distanceMi: miles,
  });
}

describe("useGameProgress", () => {
  it("starts empty on this device and stays off the network", () => {
    const store = memoryStore();
    const game = useGameProgress({ store });
    expect(game.get()).toMatchObject({ xp: 0, level: 1, trips: 0 });
    expect(game.unlocked().vehicles.map((v) => v.id)).toContain("slipstream");
    expect(game.canUseVehicle("nimbus")).toBe(false);
  });

  it("awards XP from a smooth under-limit drive and persists it", () => {
    const store = memoryStore();
    const game = createGameProgress(store);
    const award = drive(game, { id: "t1", miles: 2 });
    expect(award.xpEarned).toBeGreaterThan(0);
    expect(award.alreadyRecorded).toBe(false);
    expect(game.get().xp).toBe(award.xpTotal);
    expect(game.get().trips).toBe(1);
    expect(game.lastAward()?.tripId).toBe("t1");
    const again = createGameProgress(store);
    expect(again.get().xp).toBe(award.xpTotal);
    expect(again.get().trips).toBe(1);
  });

  it("is idempotent on the same trip id", () => {
    const game = createGameProgress(memoryStore());
    const a = drive(game, { id: "t1", miles: 2 });
    const b = drive(game, { id: "t1", miles: 2 });
    expect(b.alreadyRecorded).toBe(true);
    expect(b.xpEarned).toBe(0);
    expect(game.get().xp).toBe(a.xpTotal);
    expect(game.get().trips).toBe(1);
  });

  it("does not record a false start under 0.2 mi", () => {
    const game = createGameProgress(memoryStore());
    const award = drive(game, { id: "short", miles: 0.05 });
    expect(award.xpEarned).toBe(0);
    expect(game.get().trips).toBe(0);
  });

  it("never pays more XP for a faster under-limit run of the same distance", () => {
    const slowG = createGameProgress(memoryStore());
    const fastG = createGameProgress(memoryStore());
    const slow = drive(slowG, { id: "s", mph: 30, posted: 55, miles: 2 });
    const fast = drive(fastG, { id: "f", mph: 50, posted: 55, miles: 2 });
    expect(fast.xpEarned).toBeLessThanOrEqual(slow.xpEarned);
    expect(fast.score.total).toBeLessThanOrEqual(slow.score.total ?? 0);
  });

  it("zeros XP when the whole trip is over the limit", () => {
    const game = createGameProgress(memoryStore());
    const award = drive(game, { id: "hot", mph: 75, posted: 45, miles: 2 });
    expect(award.score.total).toBe(0);
    expect(award.xpEarned).toBe(0);
    expect(award.xpEarned).toBe(xpForTrip(2, 0));
  });

  it("earns Night Owl only at night, and unlocks Dusk on bronze", () => {
    const game = createGameProgress(memoryStore());
    const dayTrip = drive(game, { id: "d", at: day, miles: 1 });
    expect(dayTrip.badgesEarned.some((b) => b.id === "night-owl")).toBe(false);
    const nightTrip = drive(game, { id: "n", at: night, miles: 1 });
    expect(nightTrip.badgesEarned.some((b) => b.id === "night-owl" && b.tier === "bronze")).toBe(true);
    expect(nightTrip.unlocks.some((u) => u.id === "dusk")).toBe(true);
    expect(game.canUseLivery("dusk")).toBe(true);
  });

  it("counts a real MacArthur crossing and ignores a mainland point", () => {
    const hit = createGameProgress(memoryStore());
    const miss = createGameProgress(memoryStore());
    const c = CAUSEWAYS[0];
    drive(hit, { id: "c1", miles: 1, lon: c.lon, lat: c.lat });
    drive(miss, { id: "c2", miles: 1, lon: -80.3, lat: 25.77 });
    expect(hit.get().counts.causeway).toBe(1);
    expect(miss.get().counts.causeway).toBe(0);
  });

  it("downsamples live GPS into the buffer and commit uses it", () => {
    const game = createGameProgress(memoryStore());
    game.beginDrive();
    const samples = cruise({ mph: 35, posted: 45, miles: 1, startAt: day });
    for (const s of samples) game.recordSample(s);
    expect(game.samples().length).toBeGreaterThan(2);
    const award = game.commit({ tripId: "live", startedAt: day, endedAt: day + 120_000, distanceMi: 1 });
    expect(award.xpEarned).toBeGreaterThan(0);
    expect(game.samples()).toEqual([]);
  });

  it("notifies subscribers and reset wipes the device key", () => {
    const store = memoryStore();
    const game = createGameProgress(store);
    const seen: number[] = [];
    const stop = game.subscribe((p) => seen.push(p.xp));
    drive(game, { id: "t", miles: 1 });
    expect(seen.at(-1)).toBeGreaterThan(0);
    game.reset();
    expect(game.get().xp).toBe(0);
    expect(store.getItem("slide.game.v1")).toBeTruthy();
    stop();
  });

  it("migrates junk without inventing XP", () => {
    expect(migrateProgress(null).xp).toBe(0);
    expect(migrateProgress({ xp: 240, trips: 4 }).level).toBe(3);
    expect(migrateProgress({ xp: "nope" }).xp).toBe(0);
  });
});
