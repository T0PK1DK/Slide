import { describe, expect, it } from "vitest";
import {
  dirsFromMask,
  laneStripHtml,
  laneUseLabel,
  LANE_APPROACH_MI,
  normalizeLanes,
} from "./strip";

describe("normalizeLanes", () => {
  it("reads Valhalla bitmasks: directions + active / valid", () => {
    const lanes = normalizeLanes([
      { directions: 2 },
      { directions: 2 },
      { directions: 32, active: 32 },
    ]);
    expect(lanes).toEqual([
      { dirs: ["through"], valid: false, active: false },
      { dirs: ["through"], valid: false, active: false },
      { dirs: ["slightRight"], valid: true, active: true },
    ]);
  });

  it("accepts indication strings and boolean flags", () => {
    const lanes = normalizeLanes([
      { indications: ["left", "through"], valid: true, active: false },
      { indications: ["right"], valid: false, active: true },
    ]);
    expect(lanes[0]).toEqual({ dirs: ["left", "through"], valid: true, active: false });
    expect(lanes[1]).toMatchObject({ dirs: ["right"], active: true, valid: true });
  });

  it("hides when there is no lane data", () => {
    expect(normalizeLanes(undefined)).toEqual([]);
    expect(normalizeLanes([])).toEqual([]);
    expect(normalizeLanes([{ directions: 0 }])).toEqual([]);
  });

  it("decodes the documented bitmask table", () => {
    expect(dirsFromMask(8)).toEqual(["left"]);
    expect(dirsFromMask(10)).toEqual(["through", "left"]);
    expect(dirsFromMask(64 + 2)).toEqual(["through", "right"]);
  });
});

describe("lane strip markup", () => {
  it("marks active lanes and names the right-hand ones", () => {
    const lanes = normalizeLanes([
      { directions: 2 },
      { directions: 64, valid: 64 },
      { directions: 64, active: 64 },
    ]);
    expect(laneUseLabel(lanes)).toBe("Use the right lane");
    const html = laneStripHtml(lanes);
    expect(html).toContain('data-active="true"');
    expect(html).toContain('data-dir="right"');
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
  });

  it("stays off until the maneuver is close", () => {
    expect(LANE_APPROACH_MI).toBeGreaterThan(0.5);
    expect(LANE_APPROACH_MI).toBeLessThan(1);
  });
});
