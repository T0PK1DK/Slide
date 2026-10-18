import { describe, expect, it } from "vitest";
import { LOOK_FIXTURES, lookDataFromNard } from "./fixtures";
import { ghostLngLat, modelKeyOf, storeLngLat, storeName } from "./types";

describe("look types vs Nard shapes", () => {
  it("keeps a full store in Nard's sample shape", () => {
    const walmart = LOOK_FIXTURES.stores.find((s) => s.brandKey === "walmart");
    expect(walmart).toMatchObject({
      id: "osm:node/123",
      name: "Walmart Supercenter",
      brand: "Walmart",
      brandKey: "walmart",
      category: "grocery",
      color: "#0071ce",
      modelKey: "walmart",
    });
    expect(storeLngLat(walmart!)).toEqual([-80.138, 26.1228]);
  });

  it("keeps a sparse store renderable", () => {
    const corner = LOOK_FIXTURES.stores.find((s) => s.id === "osm:node/corner-1");
    expect(storeName(corner!)).toBe("Corner Mart");
    expect(modelKeyOf(corner!)).toBe("generic-other");
    expect(corner?.address).toBeUndefined();
    expect(corner?.hours).toBeUndefined();
    expect(corner?.phone).toBeUndefined();
    expect(LOOK_FIXTURES.places[corner!.id!]).toBeUndefined();
  });

  it("reads ghost lat/lon and position", () => {
    const king = LOOK_FIXTURES.ghosts[0];
    const mira = LOOK_FIXTURES.ghosts[1];
    expect(ghostLngLat(king)).toEqual([-80.1375, 26.122]);
    expect(ghostLngLat(mira)).toEqual([-80.136, 26.1232]);
    expect(king.carModelKey).toBe("slipstream");
  });

  it("passes Nard arrays through lookDataFromNard", () => {
    const next = lookDataFromNard(LOOK_FIXTURES.stores, Object.values(LOOK_FIXTURES.places), LOOK_FIXTURES.ghosts);
    expect(next.stores).toHaveLength(LOOK_FIXTURES.stores.length);
    expect(next.places["osm:node/123"]?.openNow).toBe(true);
    expect(next.ghosts).toHaveLength(3);
  });
});
