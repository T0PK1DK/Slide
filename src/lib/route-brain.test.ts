import { describe, expect, it } from "vitest";
import { etaNoteFor, offerFromTraffic, RouteBrain, routeKey, tomtomTotalSec } from "./route-brain";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

// A straight ~10 mi line north from Fort Lauderdale (real coordinates, ~0.0145° lat per mile).
const LINE: Array<[number, number]> = Array.from({ length: 11 }, (_, i) => [-80.1497, 26.1325 + i * 0.01447]);
const KEY = routeKey("r0", LINE, 10);
const route = (baselineSec = 1200) => ({ key: KEY, distanceMi: 10, baselineSec, coords: LINE });

describe("route brain: source rules", () => {
  it("starts on the Valhalla baseline", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    const s = b.snapshot();
    expect(s.totalSec).toBe(1200);
    expect(s.source).toBe("valhalla");
    expect(s.live).toBe(false);
  });

  it("first TomTom number lands at once", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 })).toBe(true);
    expect(b.snapshot()).toMatchObject({ totalSec: 1500, source: "tomtom", live: true, delaySec: 300 });
  });

  it("never flip-flops: flow can't replace a fresh TomTom number", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    const seen: number[] = [b.snapshot().totalSec];
    for (let i = 0; i < 10; i++) {
      c.advance(15_000);
      // Alternate a flow sample (very different) and TomTom (same) like the old poll loop did.
      b.offer({ routeKey: KEY, source: i % 2 ? "flow" : "tomtom", totalSec: i % 2 ? 1250 : 1500 });
      b.tick();
      seen.push(b.snapshot().totalSec);
    }
    expect(new Set(seen)).toEqual(new Set([1500]));
    expect(b.snapshot().source).toBe("tomtom");
  });

  it("ignores offers for another line (late answer after a route switch)", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    expect(b.offer({ routeKey: "r1:other", source: "tomtom", totalSec: 2000 })).toBe(false);
    expect(b.snapshot().totalSec).toBe(1200);
  });

  it("same line again keeps the live number; a new line starts over", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    expect(b.setRoute(route())).toBe(false);
    expect(b.snapshot().totalSec).toBe(1500);
    const other = LINE.slice(0, 6);
    expect(b.setRoute({ key: routeKey("r0", other, 5), distanceMi: 5, baselineSec: 600, coords: other })).toBe(true);
    expect(b.snapshot()).toMatchObject({ totalSec: 600, source: "valhalla" });
  });

  it("rejects a result that is clearly a different road", () => {
    const b = new RouteBrain({ now: clock().now });
    b.setRoute(route());
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 300 })).toBe(false);
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 99_999 })).toBe(false);
    expect(b.snapshot().source).toBe("valhalla");
  });
});

describe("route brain: smoothing", () => {
  it("ignores changes under 45 s", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    c.advance(60_000);
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1540 })).toBe(false);
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1460 })).toBe(false);
    expect(b.snapshot().totalSec).toBe(1500);
  });

  it("ignores changes under 3 % on a long trip even when over 45 s", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute({ ...route(6000), distanceMi: 10 });
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 6000 + 60 })).toBe(false); // 60 s but 1 %
    c.advance(60_000);
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 6000 + 150 })).toBe(false); // 2.5 %
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 6000 + 240 })).toBe(true); // 4 %
    expect(b.snapshot().totalSec).toBe(6240);
  });

  it("rate-limits real changes to one per 20 s and applies the latest pending one", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    c.advance(5_000);
    expect(b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1700 })).toBe(false);
    expect(b.snapshot().totalSec).toBe(1500);
    c.advance(5_000);
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1800 });
    expect(b.tick()).toBe(false); // only 10 s since the last change
    c.advance(10_000);
    expect(b.tick()).toBe(true);
    expect(b.snapshot().totalSec).toBe(1800);
  });

  it("a pending change that falls back inside the threshold is dropped", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    c.advance(5_000);
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1700 });
    c.advance(5_000);
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1510 });
    c.advance(30_000);
    expect(b.tick()).toBe(false);
    expect(b.snapshot().totalSec).toBe(1500);
  });
});

describe("route brain: fallback", () => {
  it("a TomTom failure holds the last number (no jump back to typical)", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    c.advance(15_000);
    b.fail(KEY);
    c.advance(15_000);
    b.fail(KEY);
    expect(b.snapshot()).toMatchObject({ totalSec: 1500, source: "tomtom", live: true });
  });

  it("after TomTom goes stale the badge drops but the minutes stay", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    c.advance(6 * 60_000);
    const s = b.snapshot();
    expect(s.totalSec).toBe(1500);
    expect(s.live).toBe(false);
    expect(etaNoteFor(s, "Typical time")).toBe("Recent traffic · refreshing");
  });

  it("flow takes over quietly only once TomTom is stale, with smoothing", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    c.advance(60_000);
    expect(b.offer({ routeKey: KEY, source: "flow", totalSec: 1520 })).toBe(false); // TomTom still fresh
    expect(b.snapshot().source).toBe("tomtom");
    c.advance(5 * 60_000);
    expect(b.offer({ routeKey: KEY, source: "flow", totalSec: 1520 })).toBe(false); // accepted, but under threshold
    expect(b.snapshot()).toMatchObject({ source: "flow", totalSec: 1500, live: true });
  });

  it("flow fills in when TomTom never answered", () => {
    const b = new RouteBrain({ now: clock().now });
    b.setRoute(route());
    b.fail(KEY);
    expect(b.offer({ routeKey: KEY, source: "flow", totalSec: 1400 })).toBe(true);
    expect(etaNoteFor(b.snapshot(), "x")).toBe("Live speeds · +3 min");
  });

  it("traffic switched off returns to the baseline", () => {
    const b = new RouteBrain({ now: clock().now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    b.dropLive();
    expect(b.snapshot()).toMatchObject({ totalSec: 1200, source: "valhalla", live: false });
  });
});

describe("route brain: progress scaling", () => {
  it("scales the committed time by the share of this line left", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    const lineMi = LINE.length > 1 ? 10 * 0.01447 * 69.09 : 0; // ≈ 10 mi of latitude
    b.setProgress(lineMi / 4);
    const s = b.snapshot();
    expect(s.progress).toBeCloseTo(0.25, 1);
    expect(s.remainingSec).toBeCloseTo(1500 * (1 - s.progress), 5);
    expect(s.arrivalAt).toBe(c.now() + s.remainingSec * 1000);
    expect(s.remainingMi).toBeCloseTo(10 * (1 - s.progress), 5);
  });

  it("a mid-drive traffic update rescales remaining time without switching source", () => {
    const c = clock();
    const b = new RouteBrain({ now: c.now });
    b.setRoute(route());
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1500 });
    b.setProgress(5);
    const before = b.snapshot();
    c.advance(30_000);
    b.offer({ routeKey: KEY, source: "flow", totalSec: 1000 }); // ignored: lower rank, TomTom fresh
    expect(b.snapshot().remainingSec).toBeCloseTo(before.remainingSec, 5);
    b.offer({ routeKey: KEY, source: "tomtom", totalSec: 1800 });
    expect(b.snapshot().remainingSec).toBeCloseTo(1800 * (1 - before.progress), 5);
  });

  it("ignores small GPS snaps backwards but follows a real one", () => {
    const b = new RouteBrain({ now: clock().now });
    b.setRoute(route());
    b.setProgress(4);
    const p = b.snapshot().progress;
    b.setProgress(3.9);
    expect(b.snapshot().progress).toBe(p);
    b.setProgress(2);
    expect(b.snapshot().progress).toBeLessThan(p);
  });

  it("remaining time never goes below zero past the end", () => {
    const b = new RouteBrain({ now: clock().now });
    b.setRoute(route());
    b.setProgress(50);
    expect(b.snapshot().remainingSec).toBe(0);
  });
});

describe("tomtomTotalSec", () => {
  it("uses TomTom travel time when its line matches ours", () => {
    expect(tomtomTotalSec({ baselineSec: 1200, distanceMi: 10, travelTimeSec: 1400, trafficDelaySec: 100, lengthMeters: 16_093 })).toBe(1400);
  });
  it("keeps our baseline plus TomTom's delay when TomTom took another road", () => {
    expect(tomtomTotalSec({ baselineSec: 1200, distanceMi: 10, travelTimeSec: 2400, trafficDelaySec: 100, lengthMeters: 30_000 })).toBe(1300);
  });
  it("returns null for a broken answer", () => {
    expect(tomtomTotalSec({ baselineSec: 1200, distanceMi: 10, travelTimeSec: 0, trafficDelaySec: 0, lengthMeters: 16_000 })).toBeNull();
  });
});

describe("offerFromTraffic", () => {
  it("routing → TomTom offer, flow → baseline + delay, nothing → null", () => {
    expect(offerFromTraffic({ source: "routing", delaySec: 120, travelTimeSec: 1320, lengthMeters: 16_093 }, KEY, 1200, 10)).toEqual({ routeKey: KEY, source: "tomtom", totalSec: 1320 });
    expect(offerFromTraffic({ source: "flow", delaySec: 90 }, KEY, 1200, 10)).toEqual({ routeKey: KEY, source: "flow", totalSec: 1290 });
    expect(offerFromTraffic(null, KEY, 1200, 10)).toBeNull();
  });

  it("a new drive on the same line restarts the countdown", () => {
    const b = new RouteBrain({ now: clock().now });
    b.setRoute(route());
    b.setProgress(6);
    b.resetProgress();
    expect(b.snapshot().progress).toBe(0);
  });
});
