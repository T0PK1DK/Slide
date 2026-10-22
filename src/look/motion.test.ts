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
  CLUSTER_EXPAND_PAD,
  PIN_COLLIDE_FOCUS_M,
  PIN_COLLIDE_M,
  PIN_FADE_NEAR,
  PIN_SIZE_HOT,
  PIN_SIZE_REST,
  easeOutCubic,
  haloPulse,
  haloRadiusExpr,
  pinDropPaint,
  pinSelectScale,
  pinSizeExpr,
  clusterExpandZoom,
  clusterTapPlan,
  pickClusterWinner,
  rankPins,
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

  it("ranks selected then nearest pins and fades stacked neighbors", () => {
    const shell = { id: "shell", lon: -80.1362, lat: 26.1188 };
    const bp = { id: "bp", lon: -80.1358, lat: 26.1186 };
    const far = { id: "far", lon: -80.14, lat: 26.125 };
    const ranks = rankPins([shell, bp, far], { center: { lon: -80.1362, lat: 26.1188 }, selected: "shell" });
    expect(ranks.get("shell")?.sortKey).toBe(0);
    expect(ranks.get("shell")?.fade).toBe(1);
    expect(ranks.get("bp")!.sortKey).toBeGreaterThan(0);
    expect(ranks.get("bp")!.sortKey).toBeLessThan(ranks.get("far")!.sortKey);
    expect(ranks.get("bp")?.fade).toBe(PIN_FADE_NEAR);
    expect(ranks.get("far")?.fade).toBe(1);
    expect(PIN_COLLIDE_M).toBeGreaterThan(30);
  });

  it("picks the leaf nearest the cluster point as the label winner", () => {
    const winner = pickClusterWinner(
      [
        { id: "bp", lon: -80.1358, lat: 26.1186 },
        { id: "shell", lon: -80.1362, lat: 26.1188 },
        { id: "chevron", lon: -80.1366, lat: 26.1184 },
      ],
      { lon: -80.1362, lat: 26.1188 },
    );
    expect(winner).toBe("shell");
    expect(pickClusterWinner([], { lon: 0, lat: 0 })).toBeNull();
  });

  it("fades a wider pack after a cluster expand focus", () => {
    const mPerDeg = 111320;
    const winner = { id: "w", lon: 0, lat: 0 };
    const mid = { id: "m", lon: 0, lat: 70 / mPerDeg };
    const far = { id: "f", lon: 0, lat: 200 / mPerDeg };
    const tight = rankPins([winner, mid, far], { center: { lon: 0, lat: 0 }, selected: "w" });
    const wide = rankPins([winner, mid, far], {
      center: { lon: 0, lat: 0 },
      selected: "w",
      collideM: PIN_COLLIDE_FOCUS_M,
    });
    expect(tight.get("m")?.fade).toBe(1);
    expect(wide.get("m")?.fade).toBe(PIN_FADE_NEAR);
    expect(wide.get("f")?.fade).toBe(1);
    expect(PIN_COLLIDE_FOCUS_M).toBeGreaterThan(PIN_COLLIDE_M);
  });

  it("expands on the first cluster tap and selects on a second when already open", () => {
    const leaves = [
      { id: "bp", lon: -80.1358, lat: 26.1186 },
      { id: "shell", lon: -80.1362, lat: 26.1188 },
    ];
    const center = { lon: -80.1362, lat: 26.1188 };
    const first = clusterTapPlan({
      leaves,
      center,
      expansionZoom: 14,
      currentZoom: 13.2,
      focusId: null,
    });
    expect(first).toMatchObject({ action: "expand", focusId: "shell" });
    if (first.action === "expand") {
      expect(first.zoom).toBeGreaterThanOrEqual(clusterExpandZoom(14, 14));
      expect(first.zoom).toBeGreaterThan(13.2 + CLUSTER_EXPAND_PAD - 0.001);
    }
    const second = clusterTapPlan({
      leaves,
      center,
      expansionZoom: 14,
      currentZoom: 15.2,
      focusId: "shell",
    });
    expect(second).toEqual({ action: "select", id: "shell" });
    const stillZooming = clusterTapPlan({
      leaves,
      center,
      expansionZoom: 16,
      currentZoom: 14.2,
      focusId: "shell",
    });
    expect(stillZooming.action).toBe("expand");
  });
});
