import { describe, expect, it } from "vitest";
import { ALL_LIVERIES, LIVERIES, UNLOCK_VEHICLES, VEHICLES, vehicleById, vehicleSvg } from "./vehicles";
import { migrateGarage } from "./garage";

describe("rides", () => {
  it("every ride renders with its paint, accent and unique ids", () => {
    for (const v of VEHICLES) {
      for (const livery of LIVERIES) {
        const a = vehicleSvg({ model: v.id, paint: "#d7263d", accent: "#f0a04b", livery });
        const b = vehicleSvg({ model: v.id, paint: "#d7263d", accent: "#f0a04b", livery });
        expect(a).toContain('viewBox="0 0 48 84"');
        expect(a).toContain("#d7263d");
        expect(a).toContain("#f0a04b");
        expect(a.match(/id="(v[0-9a-z]+)c"/)![1]).not.toBe(b.match(/id="(v[0-9a-z]+)c"/)![1]);
      }
    }
  });
  it("unknown model falls back to the first ride", () => {
    expect(vehicleById("nope").id).toBe(VEHICLES[0].id);
  });
  it("unlockable originals render and do not replace the starter six", () => {
    expect(VEHICLES.map((v) => v.id)).toEqual(["slipstream", "brawler", "hatch", "ridge", "hauler", "classic"]);
    for (const v of UNLOCK_VEHICLES) {
      const svg = vehicleSvg({ model: v.id, paint: "#111318", accent: "#78e0c8", livery: "halo" });
      expect(svg).toContain('viewBox="0 0 48 84"');
      expect(vehicleById(v.id).id).toBe(v.id);
    }
    expect(ALL_LIVERIES).toEqual(["solid", "stripes", "fade", "halo", "dusk"]);
  });
  it("garage keeps a valid ride and livery, rejects junk", () => {
    expect(migrateGarage(null)).toMatchObject({ vehicle: "slipstream", livery: "stripes" });
    expect(migrateGarage({ vehicle: "hauler", livery: "fade" })).toMatchObject({ vehicle: "hauler", livery: "fade" });
    expect(migrateGarage({ vehicle: "nimbus", livery: "dusk" })).toMatchObject({ vehicle: "nimbus", livery: "dusk" });
    expect(migrateGarage({ vehicle: "batmobile", livery: "chrome" })).toMatchObject({ vehicle: "slipstream", livery: "stripes" });
  });
});
