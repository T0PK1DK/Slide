import { describe, expect, it } from "vitest";
import { buildAlerts, suggestSwitch } from "./alerts";
import { minutesByDay, weekTiles, type TripRecord } from "./history";
import type { SlideRoute } from "./smooth";

const DAY = 864e5;
const NOW = new Date(2026, 8, 25, 12).getTime();
const trip = (daysAgo: number, over: Partial<TripRecord> = {}): TripRecord => ({
  id: `t${daysAgo}`, startedAt: NOW - daysAgo * DAY, endedAt: 0, destLabel: "Work", routeLabel: "Slide",
  distanceMi: 10, plannedSec: 1200, actualSec: 1200, slideScore: 80, lefts: 1, offRouteEvents: 0, postedProfile: [], ...over,
});
const band = (postedMph: number, fromMi: number, name = "Biscayne Blvd") =>
  ({ fromMi, toMi: fromMi + 1, name, postedMph, expectedMph: postedMph, seconds: 60, roadClass: "primary" });
const route = (over: Partial<SlideRoute>): SlideRoute =>
  ({ id: "r0", label: "Slide", tags: ["Slide pick"], durationSec: 1800, lefts: 1, signals: 4, slideScore: 80, hasToll: false, bands: [], ...over } as unknown as SlideRoute);

describe("buildAlerts — real sources only", () => {
  it("with nothing planned, only says no incident feed is connected", () => {
    const a = buildAlerts({ avoidTolls: false, trips: [] }, NOW);
    expect(a).toHaveLength(1);
    expect(a[0].level).toBe("info");
    expect(a[0].title).toMatch(/No live incident feed/);
  });
  it("flags posted-speed drops of 10+ mph on the planned line", () => {
    const a = buildAlerts({ route: route({ bands: [band(45, 0), band(30, 1.2), band(35, 2)] }), avoidTolls: false, trips: [] }, NOW);
    expect(a[0]).toMatchObject({ level: "orange", title: "Speed limit drops 45 → 30 mph" });
    expect(a.some((x) => x.title.includes("30 → 35"))).toBe(false);
  });
  it("warns when Avoid tolls couldn't be honoured, and never shows a price", () => {
    const a = buildAlerts({ route: route({ hasToll: true }), avoidTolls: true, trips: [] }, NOW);
    expect(a[0].level).toBe("orange");
    expect(a.map((x) => x.title + x.detail).join(" ")).not.toMatch(/\$/);
  });
  it("uses real weather and this week's off-route moments", () => {
    const a = buildAlerts({ avoidTolls: false, trips: [trip(1, { offRouteEvents: 2 }), trip(9, { offRouteEvents: 5 })], weather: "Rain" }, NOW);
    expect(a.map((x) => x.title)).toEqual(expect.arrayContaining(["Rain at the map center", "2 off-route moments this week"]));
  });
});

describe("suggestSwitch", () => {
  it("offers the quicker line with real minutes saved", () => {
    const s = suggestSwitch([route({ id: "a", durationSec: 1800 }), route({ id: "b", tags: ["Fastest"], durationSec: 1500, lefts: 3 })], "a");
    expect(s).toMatchObject({ targetId: "b", savesMin: 5, title: "Switch to Fastest" });
    expect(s?.detail).toMatch(/2 more lefts/);
  });
  it("from the fastest line, offers the smoother Slide pick instead", () => {
    const s = suggestSwitch([route({ id: "a", tags: ["Slide pick"], durationSec: 1560, lefts: 0, slideScore: 90 }), route({ id: "b", tags: ["Fastest"], durationSec: 1500, lefts: 3, slideScore: 60 })], "b");
    expect(s).toMatchObject({ targetId: "a", title: "Switch to the Slide pick", savesMin: -1 });
  });
  it("says nothing with a single line", () => {
    expect(suggestSwitch([route({})], "r0")).toBeNull();
  });
});

describe("weekTiles / minutesByDay", () => {
  it("compares this week with the week before", () => {
    const t = weekTiles([trip(1, { actualSec: 1500 }), trip(2, { actualSec: 1500, tollRoad: true }), trip(8, { actualSec: 1800 })], NOW);
    expect(t.avgTripMin).toEqual({ value: 25, delta: -5 });
    expect(t.tollTrips.value).toBe(1);
    expect(t.miles).toEqual({ value: 20, delta: 10 });
  });
  it("has no trend without a prior week, and dashes with no trips", () => {
    expect(weekTiles([trip(1)], NOW).miles.delta).toBeNull();
    expect(weekTiles([], NOW).onTime).toEqual({ value: null, delta: null });
  });
  it("buckets minutes into the last 7 days, today last", () => {
    const m = minutesByDay([trip(0, { actualSec: 600 }), trip(0, { actualSec: 600 }), trip(3, { actualSec: 1200 }), trip(9)], NOW);
    expect(m).toEqual([0, 0, 0, 20, 0, 0, 20]);
  });
});
