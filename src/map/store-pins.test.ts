import { describe, expect, it } from "vitest";
import { LOOK_FIXTURES } from "../look/fixtures";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  PIN_PIXEL_RATIO,
  PIN_SPRITE_SIZE,
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
  });

  it("draws a 128px sprite so downsample stays sharp", () => {
    expect(PIN_SPRITE_SIZE).toBe(128);
    expect(PIN_PIXEL_RATIO).toBe(2);
  });

  it("uses darker pin labels and cluster strokes in day", () => {
    expect(pinLabelPaint(true).color).toBe("#1c1812");
    expect(pinLabelPaint(false).color).toBe("#f4f3ef");
    expect(clusterStrokeColor(true)).not.toBe(clusterStrokeColor(false));
  });
});
