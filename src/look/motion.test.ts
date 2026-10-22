import { describe, expect, it } from "vitest";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_RADIUS,
  CLUSTER_RADIUS,
  STORE_LAYER_CLUSTER_GLOW,
  STORE_LAYER_SELECTED,
} from "../map/store-pins";
import {
  easeOutCubic,
  haloPulse,
  haloRadiusExpr,
  pinDropPaint,
  pinSizeExpr,
  storeIdsKey,
} from "./motion";

describe("look motion", () => {
  it("drops pins from above and lands at rest", () => {
    const start = pinDropPaint(0);
    const mid = pinDropPaint(0.4);
    const end = pinDropPaint(1);
    expect(start.translate[1]).toBeLessThan(0);
    expect(start.opacity).toBe(0);
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
    expect(haloRadiusExpr(3)[0]).toBe("+");
    expect(haloPulse(0).radiusBoost).toBeGreaterThan(0);
    expect(haloPulse(1200).opacity).not.toBe(haloPulse(0).opacity);
  });

  it("keeps cluster constants phone-readable when zoomed out", () => {
    expect(CLUSTER_RADIUS).toBeGreaterThan(30);
    expect(CLUSTER_MAX_ZOOM).toBeGreaterThanOrEqual(12);
    expect(CLUSTER_MIN_RADIUS).toBeGreaterThanOrEqual(16);
    expect(STORE_LAYER_CLUSTER_GLOW).toContain("cluster");
    expect(STORE_LAYER_SELECTED).toContain("selected");
    expect(storeIdsKey(["b", "a"])).toBe("a|b");
  });
});
