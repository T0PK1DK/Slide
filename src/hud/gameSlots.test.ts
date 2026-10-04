import { describe, expect, it } from "vitest";
import { hasArrivalAward, demoAward, shareInputFromAward, currentRide } from "./gameSlots";
import { rideSpec } from "../lib/game/carStage";
import type { TripAward } from "../lib/game";

const blank: TripAward = {
  ...demoAward(),
  xpEarned: 0,
  leveledUp: false,
  badgesEarned: [],
  unlocks: [],
};

describe("arrival XP slot", () => {
  it("stays hidden without an award", () => {
    expect(hasArrivalAward(null)).toBe(false);
    expect(hasArrivalAward({ ...blank, alreadyRecorded: true, xpEarned: 12 })).toBe(false);
    expect(hasArrivalAward(blank)).toBe(false);
  });

  it("shows when the trip earned XP or a badge", () => {
    expect(hasArrivalAward(demoAward())).toBe(true);
    expect(hasArrivalAward({ ...blank, xpEarned: 8 })).toBe(true);
    expect(hasArrivalAward({ ...blank, badgesEarned: [{ id: "first-line", name: "First Line", tier: "bronze" }] })).toBe(true);
  });

  it("builds the PNG share payload from lastAward + ride, not a second button", () => {
    const ride = currentRide({ vehicle: "slipstream", livery: "stripes", carColor: "#e8eef2", glow: "#f0a04b" });
    const input = shareInputFromAward(demoAward(), ride);
    expect(input?.card.score).toBe(88);
    expect(input?.ride).toEqual({ name: ride.name, livery: ride.liveryLabel });
    expect(shareInputFromAward(null, ride)).toBeNull();
  });
});

describe("car stage specs", () => {
  it("keeps original silhouettes, no licensed names", () => {
    expect(rideSpec("hauler").bed).toBeGreaterThan(0);
    expect(rideSpec("nimbus").l).toBeGreaterThan(rideSpec("hatch").l);
    expect(rideSpec("unknown").l).toBe(rideSpec("slipstream").l);
  });
});
