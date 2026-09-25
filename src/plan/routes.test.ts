import { describe, expect, it } from "vitest";
import { rankRoutes, SLIDE_WINDOW } from "../lib/smooth";
import { costingFor, type RouteResponse, type ValhallaTrip } from "../lib/valhalla";
import { migrateGarage } from "../lib/garage";
import { bubbleCandidates, mergeVariantTrips, pickFree, tollLabel, variantsFor } from "./routeset";
import { dropIndex, moveItem, stopsReached } from "./stops";

type Scored = Parameters<typeof rankRoutes>[0][number];
const route = (durationSec: number, slideScore: number, hasToll: boolean | null = null): Scored =>
  ({ durationSec, slideScore, hasToll } as unknown as Scored);

describe("rankRoutes — Slide route contract", () => {
  it("picks the smoothest route inside +10% of the fastest", () => {
    const [first, second] = rankRoutes([route(1000, 60), route(1080, 90), route(1300, 99)]);
    expect(first.durationSec).toBe(1080);
    expect(first.tags).toEqual(["Slide pick"]);
    expect(second.durationSec).toBe(1000);
    expect(second.tags).toEqual(["Fastest"]);
  });

  it("never lets a much slower route win, however smooth", () => {
    const ranked = rankRoutes([route(1000, 60), route(1000 * (1 + SLIDE_WINDOW) + 1, 99)]);
    expect(ranked[0].durationSec).toBe(1000);
    expect(ranked[0].tags).toEqual(["Slide pick", "Fastest"]);
    expect(ranked[1].label).toBe("Alt");
  });

  it("gives the fastest line both tags when nothing in the window is smoother", () => {
    const [only] = rankRoutes([route(900, 80)]);
    expect(only.label).toBe("Slide");
    expect(only.tags).toEqual(["Slide pick", "Fastest"]);
  });

  it("breaks score ties toward the quicker line", () => {
    const [first] = rankRoutes([route(1050, 80), route(1000, 70), route(1020, 80)]);
    expect(first.durationSec).toBe(1020);
  });
});

describe("rankRoutes — No tolls tag", () => {
  it("tags the quickest toll-free line when the fastest has tolls", () => {
    const ranked = rankRoutes([route(1000, 70, true), route(1100, 60, false), route(1200, 50, false)]);
    expect(ranked.find((r) => r.durationSec === 1100)?.tags).toContain("No tolls");
    expect(ranked.find((r) => r.durationSec === 1200)?.tags).not.toContain("No tolls");
  });
  it("adds no toll tag when the fastest is already free, or when toll status is unknown", () => {
    expect(rankRoutes([route(1000, 70, false), route(1100, 60, false)]).flatMap((r) => r.tags)).not.toContain("No tolls");
    expect(rankRoutes([route(1000, 70, null), route(1100, 60, false)]).flatMap((r) => r.tags)).not.toContain("No tolls");
  });
});

describe("costingFor", () => {
  const none = { tolls: false, highways: false, ferries: false };
  it("the No-tolls variant and the avoid-tolls option both zero use_tolls", () => {
    expect(costingFor("notolls", none).use_tolls).toBe(0);
    expect(costingFor("fastest", { ...none, tolls: true }).use_tolls).toBe(0);
    expect(costingFor("fastest", none).use_tolls).toBeGreaterThan(0);
  });
  it("applies avoid highways / ferries on top of any variant", () => {
    const c = costingFor("slide", { tolls: false, highways: true, ferries: true });
    expect(c.use_highways).toBe(0);
    expect(c.use_ferry).toBe(0);
  });
});

const trip = (time: number, length: number, shape: string): ValhallaTrip =>
  ({ summary: { time, length }, legs: [{ shape }] } as unknown as ValhallaTrip);
const ok = (value: RouteResponse): PromiseSettledResult<RouteResponse> => ({ status: "fulfilled", value });

describe("mergeVariantTrips", () => {
  it("drops duplicate lines across variants and keeps request order", () => {
    const a = trip(1000, 10, "aaa"), b = trip(1100, 11, "bbb");
    const merged = mergeVariantTrips([
      ok({ trip: a, alternates: [{ trip: b }] }),
      ok({ trip: trip(1000, 10, "aaa") }),
      { status: "rejected", reason: new Error("429") },
      ok({ trip: trip(1300, 13, "ccc") }),
    ]);
    expect(merged.map((t) => t.legs[0].shape)).toEqual(["aaa", "bbb", "ccc"]);
  });
  it("caps the number of lines", () => {
    const many = [1, 2, 3, 4, 5, 6].map((i) => ok({ trip: trip(1000 + i * 100, 10 + i, `s${i}`) }));
    expect(mergeVariantTrips(many, 4)).toHaveLength(4);
  });
  it("skips asking for No tolls when the driver already avoids tolls", () => {
    expect(variantsFor(true)).not.toContain("notolls");
    expect(variantsFor(false)).toContain("notolls");
  });
});

describe("tollLabel", () => {
  it("never guesses when the server didn't say", () => {
    expect(tollLabel(null)).toBe("");
    expect(tollLabel(true)).toBe("Has tolls");
    expect(tollLabel(false)).toBe("No tolls");
  });
});

describe("stops", () => {
  it("moveItem reorders without mutating", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a"]);
    expect(list).toEqual(["a", "b", "c"]);
    expect(moveItem(list, 5, 0)).toEqual(list);
  });
  it("dropIndex lands between row midpoints", () => {
    expect(dropIndex(5, [10, 30])).toBe(0);
    expect(dropIndex(20, [10, 30])).toBe(1);
    expect(dropIndex(99, [10, 30])).toBe(2);
  });
  it("only the next stop can be reached", () => {
    const stops = [{ lon: -80.1, lat: 25.8 }, { lon: -80.2, lat: 25.9 }];
    expect(stopsReached(stops, { lon: -80.1, lat: 25.8003 })).toBe(1);
    expect(stopsReached(stops, { lon: -80.2, lat: 25.9 })).toBe(0);
    expect(stopsReached([], { lon: 0, lat: 0 })).toBe(0);
  });
});

describe("bubble placement", () => {
  it("ranks the point where this line is farthest from the others first", () => {
    const shared: Array<[number, number]> = Array.from({ length: 50 }, (_, i) => [i / 100, 0]);
    const detour = shared.map(([x]): [number, number] => [x, x > 0.2 && x < 0.3 ? 0.05 : 0]);
    expect(bubbleCandidates(detour, [shared])[0][1]).toBe(0.05);
  });
  it("skips candidates that would overlap a placed bubble on screen", () => {
    const placed = [{ x: 100, y: 100 }];
    expect(pickFree([{ x: 120, y: 110 }, { x: 300, y: 100 }], placed)).toBe(1);
    expect(pickFree([{ x: 100, y: 200 }], placed)).toBe(0);
  });
});

describe("garage avoid options", () => {
  it("default off, and survive a save/load round trip", () => {
    expect(migrateGarage(null).avoid).toEqual({ tolls: false, highways: false, ferries: false });
    expect(migrateGarage({ avoid: { tolls: true, highways: "yes" } }).avoid).toEqual({ tolls: true, highways: false, ferries: false });
  });
});

import { retryable } from "../lib/valhalla";
import { postedDropMarks } from "../lib/timeline";
describe("retryable", () => {
  it("retries network errors, rate limits and server errors, never 4xx", () => {
    expect(retryable(null)).toBe(true);
    expect(retryable(429)).toBe(true);
    expect(retryable(503)).toBe(true);
    expect(retryable(400)).toBe(false);
    expect(retryable(404)).toBe(false);
  });
});
describe("timeline (PR #5)", () => {
  it("marks only real posted-limit drops", () => {
    const b = (from: number, mph: number | null) => ({ fromMi: from, toMi: from + 1, name: "", postedMph: mph, expectedMph: 30, seconds: 60, roadClass: "" });
    expect(postedDropMarks([b(0, 45), b(2, 30), b(4, 40), b(6, null)], 8)).toEqual([{ t: 0.25, mph: 30 }]);
  });
});
