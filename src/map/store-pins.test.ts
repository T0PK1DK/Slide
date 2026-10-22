import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOOK_FIXTURES } from "../look/fixtures";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  PIN_PIXEL_RATIO,
  PIN_SPRITE_SIZE,
  STORE_LAYER_CLUSTER_GLOW,
  STORE_LAYER_CLUSTERS,
  clusterStrokeColor,
  pinImageId,
  pinLabelPaint,
  storesToFeatureCollection,
} from "./store-pins";

describe("store pins", () => {
  it("drops stores without a point and keeps Nard's ids", () => {
    const fc = storesToFeatureCollection([...LOOK_FIXTURES.stores, { name: "Nowhere" }]);
    expect(fc.features.length).toBe(LOOK_FIXTURES.stores.length);
    const ids = fc.features.map((f) => f.properties?.id);
    expect(ids).toContain("osm:node/123");
    expect(fc.features.every((f) => f.geometry.type === "Point")).toBe(true);
  });

  it("keys sprites by brand vs category fallback", () => {
    const walmart = LOOK_FIXTURES.stores.find((s) => s.brandKey === "walmart")!;
    const corner = LOOK_FIXTURES.stores.find((s) => s.id === "osm:node/corner-1")!;
    expect(pinImageId(walmart)).toContain("look-pin-m-W-");
    expect(pinImageId(corner)).toContain("look-pin-c-other-");
  });

  it("clusters at street-ish zoom", () => {
    expect(CLUSTER_RADIUS).toBeGreaterThan(30);
    expect(CLUSTER_MAX_ZOOM).toBeGreaterThanOrEqual(12);
    expect(STORE_LAYER_CLUSTERS).toContain("cluster");
    expect(STORE_LAYER_CLUSTER_GLOW).toContain("cluster");
  });

  it("draws a 128px sprite so downsample stays sharp", () => {
    expect(PIN_SPRITE_SIZE).toBe(128);
    expect(PIN_PIXEL_RATIO).toBe(2);
  });

  it("ranks collision onto features when a center is given", () => {
    const fc = storesToFeatureCollection(LOOK_FIXTURES.stores, {
      center: { lon: -80.1362, lat: 26.1188 },
      selected: "osm:node/shell-1",
    });
    const shell = fc.features.find((f) => f.properties?.id === "osm:node/shell-1");
    const bp = fc.features.find((f) => f.properties?.id === "osm:node/bp-1");
    expect(shell?.properties?.sortKey).toBe(0);
    expect(shell?.properties?.fade).toBe(1);
    expect(Number(bp?.properties?.sortKey)).toBeGreaterThan(0);
    expect(Number(bp?.properties?.fade)).toBeLessThan(1);
    const focused = storesToFeatureCollection(LOOK_FIXTURES.stores, {
      center: { lon: -80.1362, lat: 26.1188 },
      selected: "osm:node/shell-1",
      collideM: 80,
    });
    expect(focused.features.find((f) => f.properties?.id === "osm:node/shell-1")?.properties?.fade).toBe(1);
  });

  it("uses darker pin labels and cluster strokes in day", () => {
    expect(pinLabelPaint(true).color).toBe("#1c1812");
    expect(pinLabelPaint(false).color).toBe("#f4f3ef");
    expect(clusterStrokeColor(true)).not.toBe(clusterStrokeColor(false));
  });

  it("expands a cluster first, then a second tap can select", () => {
    const src = readFileSync(new URL("./store-pins.ts", import.meta.url), "utf8");
    const expand = src.split("const expandCluster")[1]?.split("const onPinClick")[0] ?? "";
    expect(expand).toContain("clusterTapPlan");
    expect(expand).toContain("Number.isFinite(clusterId)");
    expect(expand).toContain("selected = null");
    expect(expand).toContain('plan.action === "select"');
    expect(expand).toContain("hooks.onSelect");
    expect(src).toContain("PIN_COLLIDE_FOCUS_M");
    expect(src).toContain("startFocusHalo");
    expect(src).toContain('map.on("click", STORE_LAYER_CLUSTER_GLOW, expandCluster)');
    expect(src).toContain('map.on("click", STORE_LAYER_CLUSTERS, expandCluster)');
  });
});
