import { describe, expect, it } from "vitest";
import { toCar } from "./profile";
import { lifetime, type TripRecord } from "./history";

describe("toCar", () => {
  it("keeps a valid car and drops junk", () => {
    expect(toCar({ make: " Toyota ", model: "Camry", year: 2021, fuel: "hybrid", sunpass: true, plate: "ABC123" }))
      .toEqual({ make: "Toyota", model: "Camry", year: 2021, fuel: "hybrid", sunpass: true });
  });
  it("defaults a bad fuel and year, and needs a make or model", () => {
    expect(toCar({ make: "Ford", fuel: "rocket", year: 1800 })).toEqual({ make: "Ford", model: "", year: null, fuel: "gas", sunpass: false });
    expect(toCar({ make: "", model: "" })).toBeNull();
    expect(toCar("nope")).toBeNull();
  });
});

describe("lifetime", () => {
  it("totals real trips and shows no average without drives", () => {
    const t = (mi: number, s: number) => ({ distanceMi: mi, slideScore: s } as TripRecord);
    expect(lifetime([t(10, 80), t(5, 60)])).toEqual({ drives: 2, miles: 15, smoothAvg: 70 });
    expect(lifetime([]).smoothAvg).toBeNull();
  });
});
