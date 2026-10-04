import { describe, expect, it } from "vitest";
import { scoreTripSmooth } from "./smoothScore";
import { cruise } from "./cruise";
import { levelForXp, qualityBonus, xpAtLevel, xpForTrip, xpToNextLevel } from "./xp";

describe("XP curve", () => {
  it("is the documented 40·(n-1)·n table", () => {
    expect(xpAtLevel(1)).toBe(0);
    expect(xpAtLevel(2)).toBe(80);
    expect(xpAtLevel(3)).toBe(240);
    expect(xpAtLevel(4)).toBe(480);
    expect(xpAtLevel(5)).toBe(800);
    expect(xpAtLevel(6)).toBe(1200);
    expect(xpAtLevel(10)).toBe(3600);
  });

  it("maps XP back to the same level", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(79)).toBe(1);
    expect(levelForXp(80)).toBe(2);
    expect(levelForXp(239)).toBe(2);
    expect(levelForXp(240)).toBe(3);
    expect(levelForXp(800)).toBe(5);
  });

  it("reports progress toward the next level", () => {
    expect(xpToNextLevel(80)).toEqual({ level: 2, into: 0, need: 160 });
    expect(xpToNextLevel(100)).toEqual({ level: 2, into: 20, need: 160 });
  });
});

describe("trip XP", () => {
  it("comes from smooth miles and a score-only bonus", () => {
    expect(xpForTrip(2, 100)).toBe(Math.floor(2 * 10 + 20));
    expect(xpForTrip(2, 80)).toBe(Math.floor(1.6 * 10 + 12));
    expect(xpForTrip(2, 0)).toBe(0);
    expect(xpForTrip(2, null)).toBe(0);
    expect(qualityBonus(90)).toBe(20);
    expect(qualityBonus(59)).toBe(0);
  });

  it("does not use trip duration — a faster arrival is worth no extra XP", () => {
    const score = 88;
    expect(xpForTrip(3, score)).toBe(xpForTrip(3, score));
  });
});

describe("higher speed never yields more XP", () => {
  it("same distance, both under the limit: 50 mph earns no more than 30 mph", () => {
    const miles = 2;
    const slow = scoreTripSmooth(cruise({ mph: 30, posted: 55, miles }));
    const fast = scoreTripSmooth(cruise({ mph: 50, posted: 55, miles }));
    expect(fast.total).toBeLessThanOrEqual(slow.total ?? 0);
    expect(xpForTrip(miles, fast.total)).toBeLessThanOrEqual(xpForTrip(miles, slow.total));
  });

  it("same distance, over the limit: 70 mph earns strictly less than 45 in a 45", () => {
    const miles = 2;
    const legal = scoreTripSmooth(cruise({ mph: 45, posted: 45, miles }));
    const speeding = scoreTripSmooth(cruise({ mph: 70, posted: 45, miles }));
    expect(xpForTrip(miles, speeding.total)).toBeLessThan(xpForTrip(miles, legal.total));
    expect(xpForTrip(miles, speeding.total)).toBe(0);
  });

  it("a short fast trip cannot beat a longer smooth trip via speed", () => {
    const smooth = scoreTripSmooth(cruise({ mph: 30, posted: 40, miles: 3 }));
    const sprint = scoreTripSmooth(cruise({ mph: 80, posted: 40, miles: 1 }));
    expect(xpForTrip(1, sprint.total)).toBeLessThan(xpForTrip(3, smooth.total));
  });

  it("quality bonus is identical for the same score at any speed", () => {
    expect(qualityBonus(80)).toBe(qualityBonus(80));
    expect(xpForTrip(1, 80)).toBe(xpForTrip(1, 80));
  });
});
