import { describe, expect, it } from "vitest";
import { migrateGarage } from "./garage";
import type { RadarItem } from "./reports";
import {
  bboxAround,
  colorRouteBySamples,
  congestionFromSpeeds,
  dedupeIncidents,
  delayFromSamples,
  flowSegmentUrl,
  flowTileUrl,
  formatTrafficDelay,
  fromFlowSegment,
  fromTomTomIncident,
  incidentCard,
  incidentDetailsUrl,
  incidentPoint,
  isIncidentIconKind,
  readFlowSample,
  sampleRoutePoints,
  tomtomKind,
  type FlowSample,
} from "./sources/tomtom";
import { reviewTrafficNote, trafficDelayLabel } from "./traffic";

/** Shape copied from TomTom Incident Details v5 docs (trimmed). */
const TOMTOM_CRASH = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-80.199, 25.787] },
  properties: {
    id: "a1b2c3",
    iconCategory: 1,
    magnitudeOfDelay: 3,
    events: [{ description: "Accident", code: 201, iconCategory: 1 }],
    from: "I-95 North",
    to: "NW 62nd St",
    startTime: "2026-10-05T16:12:00Z",
    delay: 360,
    length: 420,
    roadNumbers: ["I-95"],
  },
};

const sample = (over: Partial<FlowSample> = {}): FlowSample => ({
  lon: -80.2, lat: 25.78, currentMph: 28, freeFlowMph: 55, currentSec: 90, freeFlowSec: 45, closed: false, congestion: "heavy", ...over,
});

describe("TomTom incident mapper", () => {
  it("maps a recorded Incident Details crash", () => {
    expect(fromTomTomIncident(TOMTOM_CRASH)).toMatchObject({
      id: "tomtom-a1b2c3",
      source: "tomtom",
      kind: "crash",
      lon: -80.199,
      lat: 25.787,
      road: "I-95",
      delaySec: 360,
      createdAt: Date.parse("2026-10-05T16:12:00Z"),
    });
    expect(fromTomTomIncident(TOMTOM_CRASH)!.title).toBe("Accident on I-95");
    expect(fromTomTomIncident(TOMTOM_CRASH)!.detail).toContain("TomTom");
  });
  it("kinds: crash, jam, closure, construction, everything else hazard", () => {
    expect(tomtomKind(1)).toBe("crash");
    expect(tomtomKind("Accident")).toBe("crash");
    expect(tomtomKind(6)).toBe("jam");
    expect(tomtomKind(8)).toBe("closure");
    expect(tomtomKind(7)).toBe("closure");
    expect(tomtomKind(9)).toBe("roadwork");
    expect(tomtomKind(14)).toBe("hazard");
    expect(tomtomKind(0)).toBe("hazard");
  });
  it("reads a LineString from the first vertex and rejects empty geometry", () => {
    expect(incidentPoint({ type: "LineString", coordinates: [[-80.2, 25.7], [-80.1, 25.8]] })).toEqual({ lon: -80.2, lat: 25.7 });
    expect(fromTomTomIncident({ properties: { iconCategory: 1 } })).toBeNull();
    expect(fromTomTomIncident({ geometry: { coordinates: [0, 0] }, properties: { iconCategory: 1 } })).toBeNull();
  });
});

describe("congestion and delay", () => {
  it("bands speeds relative to free-flow; closed is standstill", () => {
    expect(congestionFromSpeeds(60, 60)).toBe("free");
    expect(congestionFromSpeeds(36, 60)).toBe("slow");
    expect(congestionFromSpeeds(18, 60)).toBe("heavy");
    expect(congestionFromSpeeds(8, 60)).toBe("standstill");
    expect(congestionFromSpeeds(0, 60, true)).toBe("standstill");
  });
  it("sums unique fragment delays and never invents a zero from an empty list", () => {
    expect(delayFromSamples([])).toBeNull();
    expect(delayFromSamples([sample(), sample({ currentSec: 80, freeFlowSec: 40 })])).toBe(45);
    expect(delayFromSamples([sample({ lon: -80.21, currentSec: 120, freeFlowSec: 60 })])).toBe(60);
  });
  it("formats a drive chip only when the delay is real and at least a minute", () => {
    expect(formatTrafficDelay(null)).toBeNull();
    expect(formatTrafficDelay(20)).toBeNull();
    expect(formatTrafficDelay(360)).toBe("+6 min traffic");
    expect(formatTrafficDelay(90)).toBe("+2 min traffic");
  });
  it("review note stays honest when TomTom is off", () => {
    expect(reviewTrafficNote(null)).toBe("Typical time · no live traffic yet");
    expect(reviewTrafficNote({ configured: false, delaySec: null, samples: [] })).toBe("Typical time · no live traffic yet");
    expect(reviewTrafficNote({ configured: true, delaySec: 360, samples: [sample()] })).toBe("Live traffic · +6 min traffic vs free-flow");
    expect(trafficDelayLabel({ configured: true, delaySec: 10, samples: [] })).toBeNull();
  });
});

describe("flow segment parse", () => {
  it("reads a live-shaped payload", () => {
    const raw = {
      flowSegmentData: {
        currentSpeed: 12,
        freeFlowSpeed: 50,
        currentTravelTime: 110,
        freeFlowTravelTime: 48,
        roadClosure: false,
        coordinates: { coordinate: [{ latitude: 25.78, longitude: -80.2 }] },
      },
    };
    expect(fromFlowSegment(raw, { lon: 0, lat: 0 })).toMatchObject({
      currentMph: 12, freeFlowMph: 50, currentSec: 110, freeFlowSec: 48, congestion: "heavy", lon: -80.2, lat: 25.78,
    });
    expect(fromFlowSegment({}, { lon: -80, lat: 25 })).toBeNull();
    expect(readFlowSample({ lon: -80.2, lat: 25.78, currentMph: 22, freeFlowMph: 50, currentSec: 110, freeFlowSec: 48, closed: false, congestion: "heavy" }, { lon: 0, lat: 0 })?.congestion).toBe("heavy");
    expect(readFlowSample({ congestion: "warp", currentMph: 1 }, { lon: 0, lat: 0 })).toBeNull();
  });
});

describe("route sampling and colouring", () => {
  it("keeps the ends and steps along the line", () => {
    const line: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [-80.2, 25.7 + i * 0.01]);
    const pts = sampleRoutePoints(line, 1800, 8);
    expect(pts[0]).toEqual(line[0]);
    expect(pts[pts.length - 1]).toEqual(line[line.length - 1]);
    expect(pts.length).toBeGreaterThan(2);
    expect(pts.length).toBeLessThanOrEqual(8);
  });
  it("splits a line where congestion changes", () => {
    const coords: Array<[number, number]> = [[-80.2, 25.7], [-80.2, 25.71], [-80.2, 25.8], [-80.2, 25.81]];
    const pieces = colorRouteBySamples(coords, [
      sample({ lon: -80.2, lat: 25.7, congestion: "free" }),
      sample({ lon: -80.2, lat: 25.81, congestion: "heavy" }),
    ]);
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    expect(pieces.some((p) => p.congestion === "free")).toBe(true);
    expect(pieces.some((p) => p.congestion === "heavy")).toBe(true);
  });
});

describe("incident card and dedupe", () => {
  const item = (over: Partial<RadarItem>): RadarItem => ({
    id: "x", source: "fdot", kind: "crash", lat: 25.787, lon: -80.199, title: "Crash on I-95",
    detail: "FDOT", createdAt: 1_700_000_000_000, confirms: 0, reportId: null, ...over,
  });
  it("shows type, road, delay and when — never a blank em dash", () => {
    const c = incidentCard(item({ source: "tomtom", road: "I-95", delaySec: 360, createdAt: Date.parse("2026-10-05T16:00:00Z") }), Date.parse("2026-10-05T16:06:00Z"));
    expect(c).toEqual({ type: "Crash", road: "I-95", delay: "+6 min traffic", when: "Reported 6 min ago" });
    expect(incidentCard(item({ title: "Hazard", road: undefined })).road).toBe("Road not named");
  });
  it("collapses the same crash from TomTom and FDOT, keeps police next to it", () => {
    const a = item({ id: "tomtom-1", source: "tomtom", delaySec: 360 });
    const b = item({ id: "fdot-1", source: "fdot", lat: 25.7871, lon: -80.1991 });
    const cop = item({ id: "r1", source: "driver", kind: "police", title: "Police reported" });
    const out = dedupeIncidents([b, a, cop]);
    expect(out.map((x) => x.id).sort()).toEqual(["r1", "tomtom-1"]);
  });
  it("only the six road kinds get map icons", () => {
    expect(isIncidentIconKind("crash")).toBe(true);
    expect(isIncidentIconKind("roadwork")).toBe(true);
    expect(isIncidentIconKind("camera")).toBe(false);
    expect(isIncidentIconKind("bus")).toBe(false);
  });
});

describe("Worker URL builders", () => {
  it("never put the key in the path, and keep the bbox under TomTom's cap", () => {
    expect(flowTileUrl(12, 1143, 1760, "secret")).toBe("https://api.tomtom.com/traffic/map/4/tile/flow/relative/12/1143/1760.png?key=secret");
    expect(incidentDetailsUrl(bboxAround(25.76, -80.19, 12), "secret")).toContain("key=secret");
    expect(incidentDetailsUrl(bboxAround(25.76, -80.19, 12), "secret")).toContain("bbox=");
    expect(flowSegmentUrl(25.76, -80.19, "secret")).toContain("point=25.76%2C-80.19");
    const box = bboxAround(25.76, -80.19, 999);
    expect(box.maxLat - box.minLat).toBeLessThan(1);
  });
});

describe("garage traffic toggle", () => {
  it("defaults on, keeps a saved off, rejects junk", () => {
    expect(migrateGarage(null).showTraffic).toBe(true);
    expect(migrateGarage({ showTraffic: false }).showTraffic).toBe(false);
    expect(migrateGarage({ showTraffic: "no" }).showTraffic).toBe(true);
  });
});
