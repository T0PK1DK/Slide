import { describe, expect, it } from "vitest";
import { decodeVehiclePositions } from "./sources/gtfsrt";
import { camerasFromOverpass, cameraTile, overpassQuery } from "./sources/osmcameras";
import { parseFeeds, vehiclesToItems } from "./sources/transit";
import { roughen } from "./presence";
import { nextAlert, radarBlips, type RadarItem } from "./reports";

// --- a tiny protobuf encoder, just for building test feeds ---
const varint = (n: number | bigint): number[] => { let v = BigInt(n); const out: number[] = []; do { let b = Number(v & 0x7fn); v >>= 7n; if (v) b |= 0x80; out.push(b); } while (v); return out; };
const key = (no: number, wire: number) => varint((no << 3) | wire);
const bytes = (no: number, b: number[]) => [...key(no, 2), ...varint(b.length), ...b];
const str = (no: number, s: string) => bytes(no, [...new TextEncoder().encode(s)]);
const f32 = (no: number, v: number) => { const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, v, true); return [...key(no, 5), ...new Uint8Array(d.buffer)]; };
const uint = (no: number, v: number) => [...key(no, 0), ...varint(v)];
const vehicle = (id: string, lat: number, lon: number, route: string | null, ts: number, deleted = false) =>
  bytes(2, [
    ...str(1, id),
    ...(deleted ? uint(2, 1) : []),
    ...bytes(4, [
      ...(route ? bytes(1, [...str(1, "trip-1"), ...str(5, route)]) : []),
      ...bytes(2, [...f32(1, lat), ...f32(2, lon), ...f32(3, 90), ...f32(5, 11.5)]),
      ...uint(5, ts),
      ...bytes(8, [...str(1, `veh-${id}`), ...str(2, `Bus ${id}`)]),
    ]),
  ]);
const feed = (...entities: number[][]) => new Uint8Array([...bytes(1, [...str(1, "2.0"), ...uint(3, 1727270000)]), ...entities.flat()]);

describe("GTFS-realtime decoder", () => {
  it("reads position, bearing, speed, route, label and timestamp", () => {
    const [v] = decodeVehiclePositions(feed(vehicle("12", 25.7617, -80.1918, "3", 1727270000)));
    expect(v.id).toBe("veh-12");
    expect(v.lat).toBeCloseTo(25.7617, 4);
    expect(v.lon).toBeCloseTo(-80.1918, 4);
    expect(v).toMatchObject({ bearing: 90, routeId: "3", label: "Bus 12", timestamp: 1727270000 });
    expect(v.speedMps).toBeCloseTo(11.5, 3);
  });
  it("skips deleted entities and entities without a position", () => {
    const noPos = bytes(2, [...str(1, "x"), ...bytes(4, [...uint(5, 5)])]);
    expect(decodeVehiclePositions(feed(vehicle("1", 25.8, -80.2, null, 1), vehicle("2", 25.8, -80.2, null, 1, true), noPos))).toHaveLength(1);
  });
  it("throws on a truncated feed instead of returning garbage", () => {
    const full = feed(vehicle("1", 25.8, -80.2, "9", 1));
    expect(() => decodeVehiclePositions(full.subarray(0, full.length - 3))).toThrow();
  });
});

describe("transit mapping", () => {
  it("parses feeds safely and keeps keys server-side only", () => {
    const f = parseFeeds(JSON.stringify([
      { agency: "Miami-Dade Transit", mode: "bus", url: "https://example.org/vp", header: "x-api-key", key: "secret" },
      { agency: "Tri-Rail", mode: "rail", url: "https://example.org/tr" },
      { agency: "Bad", url: "http://insecure" }, "junk",
    ]));
    expect(f.map((x) => x.agency)).toEqual(["Miami-Dade Transit", "Tri-Rail"]);
    expect(parseFeeds("not json")).toEqual([]);
    expect(parseFeeds(undefined)).toEqual([]);
  });
  it("drops stale vehicles and labels live ones", () => {
    const now = 1_000_000;
    const items = vehiclesToItems([
      { id: "a", lat: 25.8, lon: -80.2, bearing: null, speedMps: null, routeId: "3", label: null, timestamp: now - 40 },
      { id: "b", lat: 25.8, lon: -80.2, bearing: null, speedMps: null, routeId: "9", label: null, timestamp: now - 600 },
    ], { agency: "Miami-Dade Transit", mode: "bus", url: "https://x" }, now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "bus", source: "transit", title: "Bus 3", detail: "Miami-Dade Transit · live · 40 s ago" });
  });
});

describe("OSM enforcement cameras", () => {
  it("reads speed_camera nodes and enforcement-relation devices, with the right label", () => {
    const items = camerasFromOverpass({ elements: [
      { type: "node", id: 1, lat: 25.8, lon: -80.2, tags: { highway: "speed_camera", maxspeed: "30 mph" } },
      { type: "node", id: 2, lat: 25.81, lon: -80.21 },
      { type: "relation", id: 9, tags: { type: "enforcement", enforcement: "traffic_signals" }, members: [{ type: "node", ref: 2, role: "device" }] },
      { type: "node", id: 3, lat: 25.82, lon: -80.22, tags: { amenity: "cafe" } },
    ] });
    expect(items.map((i) => [i.id, i.title, i.detail])).toEqual([
      ["osm-1", "Speed camera", "OpenStreetMap · posted 30 mph"],
      ["osm-2", "Red-light camera", "OpenStreetMap"],
    ]);
  });
  it("shares one cached tile per ~11 km and builds a bounded query", () => {
    expect(cameraTile(25.87, -80.12).key).toBe(cameraTile(25.83, -80.19).key);
    expect(overpassQuery(25.8, -80.2, 25.9, -80.1)).toContain('node(r.r:"device")');
  });
  it("a camera ahead alerts within 0.3 mi only; buses never alert", () => {
    const you = { lat: 25.8, lon: -80.13 };
    const at = (id: string, kind: RadarItem["kind"], mi: number): RadarItem => ({ id, source: "osm", kind, lat: you.lat + mi / 69.055, lon: you.lon, title: "", detail: "", createdAt: 0, confirms: 0, reportId: null });
    expect(nextAlert(radarBlips([at("c", "camera", 0.5)], you, 0, 1.5), new Set())).toBeNull();
    expect(nextAlert(radarBlips([at("c", "camera", 0.25)], you, 0, 1.5), new Set())?.id).toBe("c");
    expect(nextAlert(radarBlips([at("b", "bus", 0.1)], you, 0, 1.5), new Set())).toBeNull();
  });
});

describe("presence", () => {
  it("rounds to ~1 km before anything leaves the phone", () => {
    expect(roughen(25.87654)).toBe(25.88);
    expect(roughen(-80.12345)).toBe(-80.12);
  });
});
