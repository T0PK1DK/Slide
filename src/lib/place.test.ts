import { describe, expect, it } from "vitest";
import { splitPlaceLabel } from "./place";

describe("splitPlaceLabel", () => {
  it("uses the named landmark, not a house number", () => {
    expect(splitPlaceLabel("401, Bayside Marketplace, Biscayne Blvd, Miami")).toEqual({
      name: "Bayside Marketplace",
      address: "401, Biscayne Blvd, Miami",
    });
  });

  it("falls back to the whole label when there is only one part", () => {
    expect(splitPlaceLabel("Home")).toEqual({ name: "Home", address: "Home" });
  });
});
