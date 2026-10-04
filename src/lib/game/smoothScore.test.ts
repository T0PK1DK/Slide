import { describe, expect, it } from "vitest";
import { cruise } from "./cruise";
import { limitFactor, paceFactor, scoreTripSmooth, smoothMiles, type TelemetrySample } from "./smoothScore";

describe("smooth score factors", () => {
  it("gives full pace credit for gentle changes and zero for a slam", () => {
    expect(paceFactor(0)).toBe(1);
    expect(paceFactor(2)).toBe(1);
    expect(paceFactor(10)).toBe(0);
    expect(paceFactor(-10)).toBe(0);
    expect(paceFactor(6.5)).toBeGreaterThan(0);
    expect(paceFactor(6.5)).toBeLessThan(1);
  });

  it("never rewards approaching the limit from below — under is always full credit", () => {
    expect(limitFactor(20, 45)).toBe(1);
    expect(limitFactor(45, 45)).toBe(1);
    expect(limitFactor(44, 45)).toBe(1);
    expect(limitFactor(55, 45)).toBeLessThan(1);
    expect(limitFactor(60, 45)).toBe(0);
  });
});

describe("scoreTripSmooth", () => {
  it("scores a steady under-limit cruise highly", () => {
    const s = scoreTripSmooth(cruise({ mph: 35, posted: 45, miles: 1 }));
    expect(s.total).toBeGreaterThanOrEqual(95);
    expect(s.factors.pace).not.toBeNull();
    expect(s.factors.limit).toBe(1);
    expect(s.overLimitSec).toBe(0);
    expect(s.harshBrake).toBe(false);
  });

  it("skips a missing heading instead of inventing a turn factor", () => {
    const s = scoreTripSmooth(cruise({ mph: 35, posted: 45, miles: 0.5, heading: null }));
    expect(s.factors.turn).toBeNull();
    expect(s.factors.pace).not.toBeNull();
    expect(s.total).not.toBeNull();
  });

  it("skips a missing posted limit instead of inventing compliance", () => {
    const s = scoreTripSmooth(cruise({ mph: 70, posted: null, miles: 0.5 }));
    expect(s.factors.limit).toBeNull();
    expect(s.overLimitMiles).toBe(0);
    expect(s.total).not.toBeNull();
  });

  it("returns null when there is nothing real to score", () => {
    expect(scoreTripSmooth([]).total).toBeNull();
    expect(scoreTripSmooth([{ at: 1, speedMph: 30, headingDeg: 0, postedMph: 40 }]).total).toBeNull();
  });

  it("zeros earnings on a segment driven well over the limit", () => {
    const legal = scoreTripSmooth(cruise({ mph: 40, posted: 45, miles: 1 }));
    const speeding = scoreTripSmooth(cruise({ mph: 70, posted: 45, miles: 1 }));
    expect(speeding.total).toBe(0);
    expect(speeding.overLimitSec).toBeGreaterThan(0);
    expect(legal.total).toBeGreaterThan(speeding.total ?? -1);
  });

  it("does not raise the score when the same road is driven faster (both under the limit)", () => {
    const slow = scoreTripSmooth(cruise({ mph: 30, posted: 55, miles: 2 }));
    const fast = scoreTripSmooth(cruise({ mph: 50, posted: 55, miles: 2 }));
    expect(fast.total).toBeLessThanOrEqual(slow.total ?? 0);
  });

  it("penalises a harsh brake and marks the trip", () => {
    const t0 = 1_000_000;
    const slam: TelemetrySample[] = [
      { at: t0, speedMph: 40, headingDeg: 90, postedMph: 45 },
      { at: t0 + 1000, speedMph: 40, headingDeg: 90, postedMph: 45 },
      { at: t0 + 2000, speedMph: 10, headingDeg: 90, postedMph: 45 },
      { at: t0 + 3000, speedMph: 10, headingDeg: 90, postedMph: 45 },
    ];
    const s = scoreTripSmooth(slam);
    expect(s.harshBrake).toBe(true);
    expect(s.factors.pace).not.toBeNull();
    expect(s.factors.pace!).toBeLessThan(1);
  });

  it("penalises a jerky heading change when heading is present", () => {
    const t0 = 2_000_000;
    const whip: TelemetrySample[] = [
      { at: t0, speedMph: 30, headingDeg: 0, postedMph: 40 },
      { at: t0 + 1000, speedMph: 30, headingDeg: 90, postedMph: 40 },
      { at: t0 + 2000, speedMph: 30, headingDeg: 180, postedMph: 40 },
    ];
    const calm = cruise({ mph: 30, posted: 40, miles: 0.4, heading: 10 });
    expect(scoreTripSmooth(whip).factors.turn!).toBeLessThan(scoreTripSmooth(calm).factors.turn!);
  });

  it("ignores stopped jitter instead of scoring parked time", () => {
    const t0 = 3_000_000;
    const parked: TelemetrySample[] = [
      { at: t0, speedMph: 0, headingDeg: 0, postedMph: 25 },
      { at: t0 + 1000, speedMph: 0.4, headingDeg: 12, postedMph: 25 },
      { at: t0 + 2000, speedMph: 0.2, headingDeg: 40, postedMph: 25 },
    ];
    expect(scoreTripSmooth(parked).total).toBeNull();
  });
});

describe("smoothMiles", () => {
  it("scales distance by score and is zero without a score", () => {
    expect(smoothMiles(10, 80)).toBe(8);
    expect(smoothMiles(10, null)).toBe(0);
    expect(smoothMiles(10, 0)).toBe(0);
  });
});
