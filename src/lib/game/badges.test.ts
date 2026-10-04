import { describe, expect, it } from "vitest";
import {
  applyBadgeDeltas,
  badgesFromCounts,
  emptyBadgeCounts,
  isNightDrive,
  newlyEarned,
  tierForCount,
  tripBadgeDeltas,
  type TripSignals,
} from "./badges";
import { scoreTripSmooth } from "./smoothScore";
import { cruise } from "./cruise";

const day = Date.UTC(2026, 5, 1, 15, 0, 0);

function trip(partial: Partial<TripSignals> & { mph?: number; posted?: number | null }): TripSignals {
  const samples = cruise({
    mph: partial.mph ?? 35,
    posted: partial.posted === undefined ? 45 : partial.posted,
    miles: partial.distanceMi ?? 1,
    startAt: partial.startedAt ?? day,
  });
  const score = partial.score ?? scoreTripSmooth(samples);
  return {
    score,
    distanceMi: partial.distanceMi ?? 1,
    startedAt: partial.startedAt ?? day,
    hasCoords: partial.hasCoords ?? false,
    crossedCauseway: partial.crossedCauseway ?? false,
  };
}

describe("badge tiers", () => {
  it("maps counts onto bronze / silver / gold", () => {
    const t = { bronze: 3, silver: 7, gold: 21 };
    expect(tierForCount(0, t)).toBeNull();
    expect(tierForCount(3, t)).toBe("bronze");
    expect(tierForCount(7, t)).toBe("silver");
    expect(tierForCount(21, t)).toBe("gold");
  });
});

describe("trip signals", () => {
  it("does not invent a night drive in the afternoon", () => {
    expect(isNightDrive(new Date(2026, 5, 1, 15).getTime())).toBe(false);
    expect(isNightDrive(new Date(2026, 5, 1, 2).getTime())).toBe(true);
    expect(isNightDrive(new Date(2026, 5, 1, 22).getTime())).toBe(true);
  });

  it("skips limit-keeper when no posted limit was measured", () => {
    const d = tripBadgeDeltas(0, trip({ posted: null }));
    expect(d["limit-keeper"]).toBeUndefined();
    expect(d["first-line"]).toBe(1);
  });

  it("skips causeway without real coordinates", () => {
    const d = tripBadgeDeltas(0, trip({ hasCoords: false, crossedCauseway: false }));
    expect(d.causeway).toBeUndefined();
  });

  it("counts a causeway only when coords actually crossed one", () => {
    expect(tripBadgeDeltas(0, trip({ hasCoords: true, crossedCauseway: true })).causeway).toBe(1);
  });

  it("breaks a smooth streak when the score drops", () => {
    const good = trip({ mph: 35, posted: 45 });
    expect(good.score.total).toBeGreaterThanOrEqual(75);
    expect(tripBadgeDeltas(4, good)["smooth-streak"]).toBe(5);
    const speeding = trip({ mph: 70, posted: 45 });
    expect(tripBadgeDeltas(5, speeding)["smooth-streak"]).toBe(0);
  });

  it("does not count Soft Pedal when pace was never measured", () => {
    const d = tripBadgeDeltas(0, {
      score: {
        total: 80,
        factors: { pace: null, turn: null, limit: 1 },
        scoredMiles: 1,
        overLimitMiles: 0,
        overLimitSec: 0,
        harshBrake: false,
        segments: 1,
      },
      distanceMi: 1,
      startedAt: day,
      hasCoords: false,
      crossedCauseway: false,
    });
    expect(d["gentle-brake"]).toBeUndefined();
  });

  it("applies deltas and reports a new tier", () => {
    const counts = applyBadgeDeltas(emptyBadgeCounts(), { "first-line": 1 });
    const badges = badgesFromCounts(counts);
    expect(badges["first-line"]).toBe("bronze");
    expect(newlyEarned({}, badges)).toEqual([{ id: "first-line", name: "First Line", tier: "bronze" }]);
  });
});
