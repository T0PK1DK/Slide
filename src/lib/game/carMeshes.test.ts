import { describe, expect, it } from "vitest";
import { ALL_VEHICLES } from "../vehicles";
import { rideNamesAreOriginal, rideSilhouette, rideSpec } from "./carMeshes";

describe("original 3D ride silhouettes", () => {
  it("covers every vehicles.ts ride with a unique shape", () => {
    const rows = ALL_VEHICLES.map((v) => rideSilhouette(v.id));
    expect(rows.map((r) => r.id).sort()).toEqual([...ALL_VEHICLES.map((v) => v.id)].sort());
    const shapes = new Set(rows.map((r) => r.shape));
    expect(shapes.size).toBe(rows.length);
  });

  it("matches name and type: pickup has a bed, hatch is shortest, glider is longest, ridge is tallest", () => {
    expect(rideSpec("hauler").bed).toBeGreaterThan(0);
    expect(rideSpec("hauler").shape).toBe("pickup");
    expect(rideSpec("hatch").l).toBeLessThan(rideSpec("slipstream").l);
    expect(rideSpec("glider").l).toBeGreaterThan(rideSpec("nimbus").l);
    expect(rideSpec("ridge").h).toBeGreaterThan(rideSpec("slipstream").h);
    expect(rideSpec("classic").shape).toBe("wedge");
    expect(rideSpec("slipstream").shape).toBe("hyper");
    expect(rideSpec("unknown").l).toBe(rideSpec("slipstream").l);
  });

  it("never uses a licensed brand name", () => {
    expect(rideNamesAreOriginal()).toBe(true);
  });
});
