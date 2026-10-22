import { describe, expect, it } from "vitest";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_RADIUS,
  CLUSTER_RADIUS,
  STORE_LAYER_CLUSTER_GLOW,
  STORE_LAYER_SELECTED,
  clusterDiscRadiusExpr,
  clusterGlowRadiusExpr,
} from "../map/store-pins";
import {
  PIN_SIZE_HOT,
  PIN_SIZE_REST,
  easeOutCubic,
  haloPulse,
  haloRadiusExpr,
  pinDropPaint,
  pinSelectScale,
  pinSizeExpr,
  selectedPinSizeExpr,
  storeIdsKey,
} from "./motion";

describe("look motion", () => {
  it("drops pins from above and lands at rest", () => {
    const start = pinDropPaint(0);
    const mid = pinDropPaint(0.4);
    const end = pinDropPaint(1);
    expect(start.translate[1]).toBeLessThan(0);
    expect(start.opacity).toBe(0);
    expect(pinDropPaint(0.14).translate[1]).toBeLessThan(-10);
    expect(mid.translate[1]).toBeGreaterThan(start.translate[1]);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(end).toEqual({ translate: [0, 0], opacity: 1 });
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("boosts the selected pin size expression", () => {
    const rest = pinSizeExpr(null);
    const hot = pinSizeExpr("osm:node/123");
    expect(rest[0]).toBe("interpolate");
    expect(hot[0]).toBe("case");
    expect(JSON.stringify(hot)).toContain("osm:node/123");
    expect(PIN_SIZE_HOT).toBeGreaterThan(PIN_SIZE_REST);
    expect(Number(rest[6]) - Number(rest[4])).toBeLessThan(0.05);
    expect(haloRadiusExpr(3)[0]).toBe("+");
    expect(haloPulse(0).radiusBoost).toBeGreaterThan(0);
    expect(haloPulse(1200).opacity).not.toBe(haloPulse(0).opacity);
  });

  it("pops the selected pin from rest size then lands", () => {
    const start = pinSelectScale(0);
    const mid = pinSelectScale(0.4);
    const end = pinSelectScale(1);
    expect(start).toBeLessThan(1);
    expect(mid).toBeGreaterThan(start);
    expect(end).toBe(1);
    expect(selectedPinSizeExpr(0.9)[0]).toBe("*");
    expect(JSON.stringify(selectedPinSizeExpr(1.08))).toContain("1.08");
  });

  it("keeps cluster constants phone-readable when zoomed out", () => {
    expect(CLUSTER_RADIUS).toBeGreaterThan(30);
    expect(CLUSTER_MAX_ZOOM).toBeGreaterThanOrEqual(12);
    expect(CLUSTER_MIN_RADIUS).toBeGreaterThanOrEqual(16);
    expect(STORE_LAYER_CLUSTER_GLOW).toContain("cluster");
    expect(STORE_LAYER_SELECTED).toContain("selected");
    expect(storeIdsKey(["b", "a"])).toBe("a|b");
    const disc = clusterDiscRadiusExpr();
    const glow = clusterGlowRadiusExpr();
    expect(glow[2]).toBeGreaterThan(Number(disc[2]));
    expect(JSON.stringify(glow)).toContain("point_count");
  });
});
