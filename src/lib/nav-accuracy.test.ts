import { describe, expect, it } from "vitest";
import { cumulativeMiles, offRouteLimitM, RouteSnapper, bearingDiff } from "./tracking";
import { RouteBrain, timeProfileOf, timeShareAt } from "./route-brain";
import { rankRoutes } from "./smooth";
import { sampleRoute } from "./traffic";

// An out-and-back line: north along lon -80.200, a short hop east, back south
// along lon -80.1997 (~30 m away). A plain nearest-segment snap can't tell the
// two legs apart; that is exactly the causeway / overpass case.
const north: [number, number][] = Array.from({ length: 21 }, (_, i) => [-80.2, 25.76 + i * 0.001]);
const south: [number, number][] = Array.from({ length: 21 }, (_, i) => [-80.1997, 25.78 - i * 0.001]);
const line: [number, number][] = [...north, ...south];
const cum = cumulativeMiles(line);

describe("RouteSnapper", () => {
  it("stays on the northbound leg while driving north, even next to the southbound leg", () => {
    const s = new RouteSnapper(line, cum);
    let last = 0;
    for (let i = 0; i < 18; i++) {
      // GPS drifts toward the other carriageway (closer to lon -80.1997 than -80.2).
      const p = s.snap({ pos: { lon: -80.19982, lat: 25.76 + i * 0.001 + 0.0002 }, headingDeg: 0, speedMph: 30 })!;
      expect(p.index).toBeLessThan(20);
      expect(p.alongMi).toBeGreaterThanOrEqual(last - 0.01);
      last = p.alongMi;
    }
  });

  it("follows onto the return leg once the driver actually turns back", () => {
    const s = new RouteSnapper(line, cum);
    for (let i = 0; i <= 20; i++) s.snap({ pos: { lon: -80.2, lat: 25.76 + i * 0.001 }, headingDeg: 0, speedMph: 30 });
    const back = s.snap({ pos: { lon: -80.1997, lat: 25.778 }, headingDeg: 180, speedMph: 30 })!;
    expect(back.index).toBeGreaterThanOrEqual(21);
  });

  it("recovers with a whole-line search when the window has lost the driver", () => {
    const s = new RouteSnapper(line, cum);
    s.snap({ pos: { lon: -80.2, lat: 25.76 }, headingDeg: null, speedMph: 0 });
    const far = s.snap({ pos: { lon: -80.1997, lat: 25.765 }, headingDeg: 180, speedMph: 30 })!;
    expect(far.index).toBeGreaterThanOrEqual(21);
    expect(far.offRouteM).toBeLessThan(15);
  });

  it("bearingDiff wraps around north", () => {
    expect(bearingDiff(350, 10)).toBe(20);
    expect(bearingDiff(0, 180)).toBe(180);
  });
});

describe("offRouteLimitM", () => {
  it("is the base line for a good fix and widens for a vague one, capped", () => {
    expect(offRouteLimitM(8)).toBe(60);
    expect(offRouteLimitM(70)).toBe(105);
    expect(offRouteLimitM(500)).toBe(150);
    expect(offRouteLimitM(NaN)).toBe(60);
  });
});

describe("ETA by time share, not distance share", () => {
  // 10 mi of highway in 10 min, then 2 mi of downtown in 10 min.
  const profile = timeProfileOf([{ length: 10, time: 600 }, { length: 2, time: 600 }])!;

  it("timeShareAt interpolates time along the profile", () => {
    expect(timeShareAt(profile, 0)).toBe(0);
    expect(timeShareAt(profile, 10)).toBeCloseTo(0.5);
    expect(timeShareAt(profile, 11)).toBeCloseTo(0.75);
    expect(timeShareAt(profile, 12)).toBe(1);
  });

  it("after the highway half the time is left, not 1/6", () => {
    const coords: [number, number][] = [[-80.2, 25.7], [-80.2, 25.7 + 12 / 69.05]];
    const brain = new RouteBrain({ now: () => 0 });
    brain.setRoute({ key: "k", distanceMi: 12, baselineSec: 1200, coords, profile });
    brain.setProgress(10);
    expect(brain.snapshot().remainingSec).toBeGreaterThan(550);
    expect(brain.snapshot().remainingSec).toBeLessThan(650);
  });

  it("rejects maneuvers it can't use", () => {
    expect(timeProfileOf([])).toBeNull();
    expect(timeProfileOf([{ length: NaN, time: 3 }])).toBeNull();
  });
});

describe("rankRoutes with live traffic", () => {
  const base = { trip: {} as never, shape: "", distanceMi: 10, hasToll: false, why: "", turns: 0, lefts: 0, uturns: 0, signals: 0, stopDensity: 0, speedVariance: 0, postedCoverage: 0, bands: [], maneuvers: [] };
  it("ranks on live times when every line has one", () => {
    const r = rankRoutes([
      { ...base, durationSec: 1000, liveSec: 1900, slideScore: 50 },
      { ...base, durationSec: 1100, liveSec: 1200, slideScore: 40 },
    ]);
    expect(r[0].liveSec).toBe(1200);
    expect(r[0].tags).toContain("Fastest");
  });
  it("falls back to typical times when any line is missing a live time", () => {
    const r = rankRoutes([
      { ...base, durationSec: 1000, liveSec: 1900, slideScore: 50 },
      { ...base, durationSec: 1100, slideScore: 40 },
    ]);
    expect(r[0].durationSec).toBe(1000);
  });
});

describe("sampleRoute spreads samples over long trips", () => {
  it("reaches the end of a 40 mi line, not just the first ~20 mi", () => {
    const long: [number, number][] = Array.from({ length: 401 }, (_, i) => [-80.2, 25.0 + i * (40 / 69.05) / 400]);
    const pts = sampleRoute(long, 1.8, 12);
    expect(pts.length).toBeLessThanOrEqual(12);
    // The second-to-last sample sits well past the halfway mark.
    expect(pts[pts.length - 2].lat).toBeGreaterThan(25.0 + 0.7 * (40 / 69.05));
  });
});
