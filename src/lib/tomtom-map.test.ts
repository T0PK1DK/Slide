import { describe, expect, it } from "vitest";
import { migrateGarage } from "./garage";
import {
  arrivalChipText,
  mapCreditLine,
  rewriteTomTomStyle,
  suggestRow,
  tomtomPaintForLayer,
  tomtomProxyPath,
  tomtomProxyUrl,
  tomtomStyleUrl,
  trafficChipText,
  TOMTOM_MAP_PROXY,
  TOMTOM_STYLE_VERSION,
} from "./tomtom-map";

const COLORS = {
  land: "#0d1014",
  water: "#05080c",
  road: "#8a6a42",
  roadCase: "#1c1812",
  motorway: "#c8914c",
  minor: "#3b3429",
  park: "#0f1a14",
  building: "#1a1814",
  path: "#2c2720",
  label: "#d8d4ca",
  halo: "#05070a",
};

describe("TomTom vector style URLs", () => {
  it("builds a dark MapLibre style URL and never embeds a VITE_ key", () => {
    const u = new URL(tomtomStyleUrl("secret-key", "ember"));
    expect(u.hostname).toBe("api.tomtom.com");
    expect(u.pathname).toContain(TOMTOM_STYLE_VERSION);
    expect(u.searchParams.get("key")).toBe("secret-key");
    expect(u.searchParams.get("map")).toBe("2/basic_street-dark");
    expect(tomtomStyleUrl("secret-key", "night")).not.toMatch(/VITE_/);
  });

  it("rewrites tile/glyph URLs onto the proxy and drops the key", () => {
    const raw = tomtomProxyUrl("https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.pbf?key=secret&foo=1");
    expect(raw).toBe(`${TOMTOM_MAP_PROXY}/map/1/tile/basic/main/{z}/{x}/{y}.pbf?foo=1`);
    expect(raw).not.toContain("secret");
    expect(tomtomProxyUrl("https://example.com/x")).toBeNull();
  });

  it("walks a style JSON and only proxies TomTom hosts", () => {
    const out = rewriteTomTomStyle({
      sprite: "https://api.tomtom.com/style/1/sprite/22?key=k",
      glyphs: "https://api.tomtom.com/map/1/glyph/{fontstack}/{range}.pbf?key=k",
      sources: { v: { tiles: ["https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.pbf?key=k"] } },
      other: "https://tiles.openfreemap.org/x",
    }) as { sprite: string; glyphs: string; sources: { v: { tiles: string[] } }; other: string };
    expect(out.sprite).toBe(`${TOMTOM_MAP_PROXY}/style/1/sprite/22`);
    expect(out.glyphs).toContain("{fontstack}");
    expect(out.sources.v.tiles[0]).toBe(`${TOMTOM_MAP_PROXY}/map/1/tile/basic/main/{z}/{x}/{y}.pbf`);
    expect(out.other).toBe("https://tiles.openfreemap.org/x");
  });

  it("rejects proxy paths that are not TomTom map assets", () => {
    expect(tomtomProxyPath(["map", "1", "tile", "basic", "main", "1", "2", "3.pbf"])).toBe("map/1/tile/basic/main/1/2/3.pbf");
    expect(tomtomProxyPath(["style", "1", "sprite"])).toBe("style/1/sprite");
    expect(tomtomProxyPath(["evil", "x"])).toBeNull();
    expect(tomtomProxyPath(["map", "..", "secret"])).toBeNull();
  });
});

describe("TomTom layer theming", () => {
  it("tints water, motorways and land; skips unknown layers", () => {
    expect(tomtomPaintForLayer("Water polygon", "fill", COLORS)[0]?.value).toBe(COLORS.water);
    expect(tomtomPaintForLayer("Motorway", "line", COLORS)[0]?.value).toBe(COLORS.motorway);
    expect(tomtomPaintForLayer("Background", "background", COLORS)[0]?.value).toBe(COLORS.land);
    expect(tomtomPaintForLayer("Mystery", "fill", COLORS)).toEqual([]);
  });
});

describe("map credit", () => {
  it("shows OSM on the default map and TomTom only when those tiles are on", () => {
    expect(mapCreditLine({ tomtomBasemap: false, tomtomTraffic: false })).toBe("© OpenMapTiles © OSM");
    expect(mapCreditLine({ tomtomBasemap: false, tomtomTraffic: true })).toBe("© OpenMapTiles © OSM · © TomTom");
    expect(mapCreditLine({ tomtomBasemap: true, tomtomTraffic: true })).toBe("© TomTom");
  });
});

describe("suggest rows", () => {
  it("splits a TomTom POI into name / address and credits only TomTom hits", () => {
    const row = suggestRow({
      label: "401 Biscayne Blvd, Miami, FL",
      name: "Bayside Marketplace",
      lon: -80.186, lat: 25.778, kind: "POI", source: "tomtom",
    });
    expect(row.name).toBe("Bayside Marketplace");
    expect(row.address).toBe("401 Biscayne Blvd, Miami, FL");
    expect(row.credit).toBe("© TomTom");
    expect(row.distance).toBeNull();
  });

  it("omits the TomTom credit on Photon hits and can show a real distance", () => {
    const row = suggestRow(
      { label: "Mary Brickell Village, Miami", name: "Mary Brickell Village", lon: -80.193, lat: 25.763, kind: "place", source: "photon" },
      { lon: -80.1918, lat: 25.7617 },
    );
    expect(row.credit).toBeNull();
    expect(row.distance).toMatch(/ft|mi/);
  });

  it("hides a distance under 80 m so a tap on 'here' is not a fake 0.0", () => {
    const row = suggestRow(
      { label: "Here", lon: -80.1918, lat: 25.7617, kind: "place" },
      { lon: -80.1918, lat: 25.7617 },
    );
    expect(row.distance).toBeNull();
  });
});

describe("traffic + arrival chips", () => {
  const base = { routeKey: "r0", live: true, delaySec: 360, remainingSec: 720 };
  it("prints Traffic +N min from a live delay and hides missing data", () => {
    expect(trafficChipText(base)).toBe("Traffic +6 min");
    expect(trafficChipText({ ...base, live: false })).toBeNull();
    expect(trafficChipText({ ...base, delaySec: 20 })).toBeNull();
    expect(trafficChipText({ ...base, routeKey: null })).toBeNull();
  });
  it("prints Arrives from remaining seconds only", () => {
    const now = new Date("2026-10-05T16:00:00");
    expect(arrivalChipText(base, now)).toBe("Arrives 4:12 PM");
    expect(arrivalChipText({ ...base, remainingSec: 0 }, now)).toBeNull();
    expect(arrivalChipText({ ...base, routeKey: null }, now)).toBeNull();
  });
});

describe("garage TomTom map toggle", () => {
  it("defaults off and keeps a saved on", () => {
    expect(migrateGarage(null).tomtomMap).toBe(false);
    expect(migrateGarage({ tomtomMap: true }).tomtomMap).toBe(true);
    expect(migrateGarage({ tomtomMap: "yes" }).tomtomMap).toBe(false);
  });
});
