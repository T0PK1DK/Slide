import { describe, expect, it } from "vitest";
import { completionsFromTomTom } from "./tomtom-search";
import {
  limitToMph,
  milesAlong,
  routePointsOf,
  speedLimitAt,
  speedLimitsOf,
  supportingPointsOf,
  trafficRouteOf,
} from "./tomtom-route";
import { foldTomTomIntoOfficial, sameIncident } from "./incidents-merge";
import type { RadarItem } from "./reports";

const ROUTE = {
  routes: [
    {
      summary: {
        lengthInMeters: 16093,
        travelTimeInSeconds: 1200,
        trafficDelayInSeconds: 180,
        noTrafficTravelTimeInSeconds: 1020,
      },
      legs: [
        {
          points: [
            { latitude: 26.12, longitude: -80.14 },
            { latitude: 26.13, longitude: -80.14 },
            { latitude: 26.14, longitude: -80.14 },
          ],
        },
      ],
      sections: [
        { startPointIndex: 0, endPointIndex: 1, sectionType: "SPEED_LIMIT", maxSpeedLimitInKmh: 56.327, speedLimitUnit: "km/h" },
        { startPointIndex: 1, endPointIndex: 2, sectionType: "SPEED_LIMIT", effectiveSpeedLimit: 45, speedLimitUnit: "MPH" },
      ],
    },
  ],
};

const item = (over: Partial<RadarItem>): RadarItem => ({
  id: "x",
  source: "fdot",
  kind: "crash",
  lat: 25.8,
  lon: -80.2,
  title: "Crash",
  detail: "FDOT · multi-vehicle",
  createdAt: 1,
  confirms: 0,
  reportId: null,
  ...over,
});

describe("TomTom routing overlay", () => {
  it("reads travel time, delay, and speedLimit sections when present", () => {
    const parsed = trafficRouteOf(ROUTE);
    expect(parsed).toMatchObject({ travelTimeSec: 1200, trafficDelaySec: 180, noTrafficSec: 1020, lengthMeters: 16093 });
    expect(parsed?.attribution).toBe("© TomTom");
    expect(limitToMph(56.327, "km/h")).toBe(35);
    expect(limitToMph(45, "MPH")).toBe(45);
    const spans = speedLimitsOf(ROUTE);
    expect(spans).toHaveLength(2);
    expect(spans[0].mph).toBe(35);
    expect(spans[1].mph).toBe(45);
    expect(speedLimitAt(spans, spans[1].fromMi + 0.001)).toBe(45);
    expect(speedLimitAt([], 0)).toBeNull();
    expect(trafficRouteOf({})).toBeNull();
    expect(trafficRouteOf({ routes: [{ summary: {} }] })).toBeNull();
  });

  it("keeps supporting points under the POST cap", () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ lat: 25.7 + i * 0.01, lon: -80.2 }));
    expect(supportingPointsOf(pts).length).toBeLessThanOrEqual(38);
    expect(supportingPointsOf(pts.slice(0, 2))).toEqual([]);
    expect(routePointsOf(ROUTE)).toHaveLength(3);
    expect(milesAlong(routePointsOf(ROUTE))[0]).toBe(0);
  });

  it("drops autocomplete rows that have no pin", () => {
    expect(completionsFromTomTom({ results: [{ segments: [{ value: "Bal" }, { value: "Harbour" }] }] })).toEqual(["Bal Harbour"]);
    expect(completionsFromTomTom({ results: [] })).toEqual([]);
  });
});

describe("incident merge", () => {
  it("folds a TomTom delay into the official crash and drops the twin pin", () => {
    const official = [item({ id: "fdot-1", lat: 25.8001, lon: -80.2001 })];
    const tomtom = [item({ id: "tomtom-1", source: "tomtom", lat: 25.8, lon: -80.2, detail: "TomTom · Accident · +4 min" })];
    const merged = foldTomTomIntoOfficial(official, tomtom);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("fdot");
    expect(merged[0].detail).toMatch(/TomTom \+4 min/);
    expect(sameIncident(official[0], tomtom[0])).toBe(true);
  });

  it("keeps a TomTom jam that official feeds did not send", () => {
    const merged = foldTomTomIntoOfficial(
      [item({ id: "fdot-1", kind: "crash" })],
      [item({ id: "tomtom-2", source: "tomtom", kind: "jam", lat: 25.9, lon: -80.1, detail: "TomTom · Congestion" })],
    );
    expect(merged.map((x) => x.id).sort()).toEqual(["fdot-1", "tomtom-2"]);
  });
});
