import { describe, expect, it } from "vitest";
import { ago, fromReportRow, nextAlert, offsetMi, radarBlips, type RadarItem } from "./reports";
import { fl511Kind, fromFl511, withinKm } from "./sources/fl511";
import { carLabel, mutuals, normalizeHandle } from "./social";

const you = { lat: 25.8, lon: -80.13 };
const item = (id: string, kind: RadarItem["kind"], dLatMi: number, dLonMi: number): RadarItem => ({
  id, source: "driver", kind, title: kind, detail: "", createdAt: 0, confirms: 0, reportId: 1,
  lat: you.lat + dLatMi / 69.055, lon: you.lon + dLonMi / (69.055 * Math.cos((you.lat * Math.PI) / 180)),
});

describe("radar geometry", () => {
  it("measures offsets in miles", () => {
    const o = offsetMi(you, item("a", "police", 0.5, 0));
    expect(o.north).toBeCloseTo(0.5, 3);
    expect(o.east).toBeCloseTo(0, 6);
  });
  it("is heading-up: something north is ahead when driving north, behind when driving south", () => {
    const north = [item("p", "police", 0.5, 0)];
    expect(radarBlips(north, you, 0, 1.5)[0]).toMatchObject({ ahead: true });
    expect(radarBlips(north, you, 0, 1.5)[0].y).toBeCloseTo(-0.5 / 1.5, 2);
    expect(radarBlips(north, you, 180, 1.5)[0]).toMatchObject({ ahead: false });
  });
  it("puts something east on the right when heading north, and ahead when heading east", () => {
    const east = [item("e", "crash", 0, 0.6)];
    expect(radarBlips(east, you, 0, 1.5)[0].x).toBeGreaterThan(0.3);
    expect(radarBlips(east, you, 90, 1.5)[0].ahead).toBe(true);
  });
  it("drops what's out of range, sorts nearest first, and nothing is 'ahead' without a heading", () => {
    const b = radarBlips([item("far", "crash", 3, 0), item("b", "jam", 0.9, 0), item("a", "hazard", 0.2, 0)], you, null, 1.5);
    expect(b.map((x) => x.id)).toEqual(["a", "b"]);
    expect(b.every((x) => !x.ahead)).toBe(true);
  });
});

describe("nextAlert", () => {
  const blips = radarBlips([item("jam", "jam", 0.3, 0), item("cop", "police", 0.6, 0), item("far", "crash", 1.2, 0)], you, 0, 1.5);
  it("alerts once for the nearest alert-worthy thing ahead within 0.8 mi (jams don't alert)", () => {
    expect(nextAlert(blips, new Set())?.id).toBe("cop");
    expect(nextAlert(blips, new Set(["cop"]))).toBeNull();
  });
});

describe("report rows and time", () => {
  it("never carries a reporter and words police as a driver report", () => {
    const r = fromReportRow({ id: 7, kind: "police", lat: 25.8, lon: -80.1, created_at: "2026-09-25T12:00:00Z", confirms: 2 });
    expect(r).toMatchObject({ id: "r7", reportId: 7, title: "Police reported", source: "driver" });
    expect(r.detail).toBe("Reported by drivers · 2 confirmed");
    expect(Object.keys(r)).not.toContain("reporter_id");
  });
  it("ago", () => {
    expect(ago(1000, 1000 + 20_000)).toBe("just now");
    expect(ago(0, 4 * 60_000)).toBe("4 min ago");
    expect(ago(0, 2 * 3600_000)).toBe("2 hr ago");
  });
});

describe("FL511 mapping", () => {
  it("maps event types and skips what isn't road-relevant", () => {
    expect(fl511Kind("accidentsAndIncidents", false)).toBe("crash");
    expect(fl511Kind("roadwork", false)).toBe("roadwork");
    expect(fl511Kind("roadwork", true)).toBe("closure");
    expect(fl511Kind("specialEvents", false)).toBeNull();
  });
  it("reads fields in any case and rejects events without a position", () => {
    const e = fromFl511({ ID: "99", EventType: "accidentsAndIncidents", RoadwayName: "I-95", DirectionOfTravel: "Southbound", Description: "Crash  blocking 2 left lanes", Latitude: 25.9, Longitude: -80.2, Reported: "2026-09-25T12:00:00Z" });
    expect(e).toMatchObject({ id: "fl511-99", kind: "crash", source: "fl511", title: "Crash on I-95 Southbound", detail: "FL511 · Crash blocking 2 left lanes", reportId: null });
    expect(fromFl511({ latitude: "25.9", longitude: "-80.2", eventtype: "closures" })?.kind).toBe("closure");
    expect(fromFl511({ EventType: "accidentsAndIncidents" })).toBeNull();
  });
  it("filters to a box around the driver", () => {
    const a = fromFl511({ ID: 1, EventType: "roadwork", Latitude: 25.81, Longitude: -80.13 })!;
    const b = fromFl511({ ID: 2, EventType: "roadwork", Latitude: 26.5, Longitude: -80.13 })!;
    expect(withinKm([a, b], 25.8, -80.13, 12).map((x) => x.id)).toEqual(["fl511-1"]);
  });
});

describe("social helpers", () => {
  it("normalizes handles", () => {
    expect(normalizeHandle("@King_305")).toBe("king_305");
    expect(normalizeHandle("ab")).toBeNull();
    expect(normalizeHandle("bad handle!")).toBeNull();
  });
  it("builds a car label and friends = mutual follows", () => {
    expect(carLabel({ make: "Tesla", model: "Model 3", year: 2023 })).toBe("2023 Tesla Model 3");
    expect(carLabel(null)).toBeNull();
    expect(mutuals(["a", "b", "c"], ["c", "a", "z"])).toEqual(["a", "c"]);
  });
});
