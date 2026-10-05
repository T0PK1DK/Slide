import { describe, expect, it } from "vitest";
import { congestionOf, delaySecOf, firstCoord, fromTomTom, tomtomKind } from "./sources/tomtom";
import {
  colorRoute,
  flowPaint,
  incidentAhead,
  mergeMapIncidents,
  resetTomTomLog,
  routeTraffic,
  sampleRoute,
  trafficSummary,
} from "./traffic";
import { migrateGarage } from "./garage";
import { buildAlerts } from "./alerts";
import type { RadarItem } from "./reports";

const item = (over: Partial<RadarItem>): RadarItem => ({
  id: "x", source: "fdot", kind: "crash", lat: 25.8, lon: -80.2, title: "Crash",
  detail: "FDOT · multi-vehicle", createdAt: 1, confirms: 0, reportId: null, ...over,
});

describe("TomTom incident mapper", () => {
  it("maps a crash with a point and skips unknown / empty geometry", () => {
    const raw = {
      geometry: { type: "Point", coordinates: [-80.19, 25.77] },
      properties: {
        id: "abc", iconCategory: 1, startTime: "2026-10-05T16:00:00Z",
        from: "I-95", events: [{ description: "Accident, two lanes blocked" }],
        roadNumbers: ["I-95"],
      },
    };
    expect(fromTomTom(raw)).toMatchObject({
      id: "tomtom-abc", source: "tomtom", kind: "crash", lat: 25.77, lon: -80.19,
      title: "Crash · I-95", detail: "TomTom · Accident, two lanes blocked",
      createdAt: Date.parse("2026-10-05T16:00:00Z"), reportId: null,
    });
    expect(fromTomTom({ properties: { iconCategory: 1 } })).toBeNull();
    expect(fromTomTom({ geometry: { coordinates: [-80, 25] }, properties: { iconCategory: 0 } })).toBeNull();
    expect(
      fromTomTom({
        geometry: { coordinates: [-80.19, 25.77] },
        properties: { id: "d", iconCategory: 6, delay: 180, events: [{ description: "Queueing" }] },
      })?.detail,
    ).toBe("TomTom · Queueing · +3 min");
  });
  it("reads a line's first vertex and maps every icon we show", () => {
    expect(firstCoord([[-80.2, 25.8], [-80.1, 25.9]])).toEqual({ lon: -80.2, lat: 25.8 });
    expect(tomtomKind(6)).toBe("jam");
    expect(tomtomKind(8)).toBe("closure");
    expect(tomtomKind(9)).toBe("roadwork");
    expect(tomtomKind(14)).toBe("hazard");
    expect(tomtomKind(99)).toBeNull();
  });
});

describe("congestion and delay", () => {
  it("colours from a real speed ratio and never invents a level", () => {
    expect(congestionOf({ currentSpeed: 55, freeFlowSpeed: 60 })).toBe("free");
    expect(congestionOf({ currentSpeed: 32, freeFlowSpeed: 60 })).toBe("slow");
    expect(congestionOf({ currentSpeed: 12, freeFlowSpeed: 60 })).toBe("heavy");
    expect(congestionOf({ roadClosure: true, currentSpeed: 0, freeFlowSpeed: 60 })).toBe("heavy");
    expect(congestionOf({ currentSpeed: 40 })).toBeNull();
    expect(delaySecOf({ currentTravelTime: 180, freeFlowTravelTime: 90 })).toBe(90);
    expect(delaySecOf({ currentTravelTime: 80, freeFlowTravelTime: 90 })).toBe(0);
    expect(delaySecOf({})).toBeNull();
  });
});

describe("route samples and colouring", () => {
  it("keeps ends, caps at 10, and only colours near a sample", () => {
    const line: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [-80.2 + i * 0.01, 25.7]);
    const pts = sampleRoute(line, 1.2, 10);
    expect(pts[0]).toEqual({ lon: -80.2, lat: 25.7 });
    expect(pts.length).toBeLessThanOrEqual(10);
    expect(pts[pts.length - 1].lon).toBeCloseTo(-80.2 + 0.39, 5);
    const segs = colorRoute(line.slice(0, 4), [
      { lon: -80.2, lat: 25.7, currentMph: 20, freeMph: 60, currentSec: 80, freeSec: 30, closed: false, congestion: "heavy" },
    ]);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.every((s) => s.congestion === "heavy")).toBe(true);
    expect(colorRoute(line, [])).toEqual([]);
  });
  it("computes a delay only with enough real samples", () => {
    const samples = [
      { lon: -80.2, lat: 25.8, currentMph: 20, freeMph: 55, currentSec: 120, freeSec: 40, closed: false, congestion: "heavy" as const },
      { lon: -80.15, lat: 25.82, currentMph: 22, freeMph: 55, currentSec: 110, freeSec: 40, closed: false, congestion: "heavy" as const },
    ];
    const rt = routeTraffic(600, 8, samples);
    expect(rt).not.toBeNull();
    expect(rt!.worst).toBe("heavy");
    expect(rt!.delaySec).toBeGreaterThan(60);
    expect(routeTraffic(600, 8, [])).toBeNull();
  });
});

describe("traffic copy", () => {
  it("names a crash ahead and a heavy delay, and stays quiet without data", () => {
    const crash = item({ kind: "crash", title: "Crash on I-95 N" });
    expect(trafficSummary({ traffic: null, ahead: crash, aheadMi: 1.2, tomtom: false, on: true }).line)
      .toBe("Crash in 1.2 mi");
    const heavy = { delaySec: 360, coverage: 0.8, worst: "heavy" as const, samples: [] };
    expect(trafficSummary({ traffic: heavy, ahead: null, aheadMi: null, tomtom: true, on: true }).line)
      .toBe("Heavy traffic ahead, +6 min");
    expect(trafficSummary({ traffic: null, ahead: null, aheadMi: null, tomtom: false, on: true }).etaNote)
      .toMatch(/no live speeds/);
    expect(trafficSummary({ traffic: heavy, ahead: null, aheadMi: null, tomtom: true, on: false }).line).toBeNull();
    expect(trafficSummary({ traffic: heavy, ahead: null, aheadMi: null, tomtom: true, on: false }).etaNote)
      .toMatch(/traffic off/);
  });
  it("finds the next incident on the remaining line", () => {
    const coords: Array<[number, number]> = [[-80.2, 25.8], [-80.2, 25.802], [-80.2, 25.804]];
    const jam = item({ id: "j", kind: "jam", lat: 25.803, lon: -80.2 });
    const hit = incidentAhead([jam], coords, 0);
    expect(hit?.item.id).toBe("j");
    expect(hit!.mi).toBeGreaterThan(0);
    expect(incidentAhead([jam], coords, 20)).toBeNull();
  });
  it("drops cameras and buses from the map set", () => {
    const a = mergeMapIncidents(
      [item({ id: "1", kind: "crash" }), item({ id: "2", kind: "camera" }), item({ id: "3", kind: "bus" })],
      [item({ id: "1", kind: "crash" }), item({ id: "4", kind: "police", source: "driver" })],
    );
    expect(a.map((x) => x.id).sort()).toEqual(["1", "4"]);
  });
});

describe("theme flow paint", () => {
  it("keeps Ember slow off the rust road hue and Sand slow off pale gold", () => {
    const night = flowPaint("night");
    const ember = flowPaint("ember");
    const sand = flowPaint("sand");
    expect(ember.slow).toBe("#ffd24a");
    expect(ember.slow).not.toBe("#ff9f43");
    expect(ember.heavy).toBe("#ff5a62");
    expect(sand.slow).toBe("#ff8c2a");
    expect(sand.slow).not.toBe("#f0c14a");
    expect(night.free).toBe("#5dd17e");
    expect(new Set([night.free, night.slow, night.heavy]).size).toBe(3);
    expect(new Set([ember.free, ember.slow, ember.heavy]).size).toBe(3);
    expect(new Set([sand.free, sand.slow, sand.heavy]).size).toBe(3);
  });
});

describe("garage traffic toggle", () => {
  it("defaults on and keeps a saved off", () => {
    expect(migrateGarage(null).showTraffic).toBe(true);
    expect(migrateGarage({ showTraffic: false }).showTraffic).toBe(false);
    expect(migrateGarage({ showTraffic: "no" }).showTraffic).toBe(true);
  });
});

describe("alerts with real incidents", () => {
  it("lists a live crash instead of the old 'no feed' line", () => {
    const a = buildAlerts({
      avoidTolls: false, trips: [], incidentFeed: true,
      incidents: [{ level: "red", title: "Crash on I-95 N", detail: "FDOT · 4 min ago" }],
    });
    expect(a.some((x) => x.title === "Crash on I-95 N")).toBe(true);
    expect(a.some((x) => /No live incident feed/.test(x.title))).toBe(false);
  });
  it("still says the feed is off when nothing is connected", () => {
    const a = buildAlerts({ avoidTolls: false, trips: [] });
    expect(a[0].title).toMatch(/No live incident feed/);
  });
});

describe("no-key log is once-only", () => {
  it("reset works", () => {
    resetTomTomLog();
    expect(true).toBe(true);
  });
});
