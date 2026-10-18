import { describe, expect, it } from "vitest";
import { PLACE_EMPTY } from "../look/empty";
import { LOOK_FIXTURES, placeFor } from "../look/fixtures";
import { placeCardHtml, placeCardModel, shouldOpenPlaceCard } from "./place-card";

describe("place card", () => {
  it("opens on pin, destination, or when stopped", () => {
    expect(shouldOpenPlaceCard({ trigger: "pin", moving: true })).toBe(true);
    expect(shouldOpenPlaceCard({ trigger: "destination", moving: true })).toBe(true);
    expect(shouldOpenPlaceCard({ trigger: "stopped", moving: true })).toBe(false);
    expect(shouldOpenPlaceCard({ trigger: "stopped", moving: false })).toBe(true);
  });

  it("fills a complete place", () => {
    const store = LOOK_FIXTURES.stores.find((s) => s.brandKey === "walmart")!;
    const model = placeCardModel(store, placeFor(store));
    expect(model.nameEmpty).toBe(false);
    expect(model.openKind).toBe("open");
    expect(model.hoursEmpty).toBe(false);
    expect(model.addressEmpty).toBe(false);
    expect(model.descriptionEmpty).toBe(false);
    expect(model.photosEmpty).toBe(false);
    expect(model.callHref).toContain("tel:");
    expect(model.webHref).toContain("walmart");
    const html = placeCardHtml(model);
    expect(html).toContain("data-hologram");
    expect(html).toContain(model.photos[0]!.credit);
  });

  it("empty-states every missing field", () => {
    const store = LOOK_FIXTURES.stores.find((s) => s.id === "osm:node/corner-1")!;
    const model = placeCardModel(store);
    expect(model.hours).toBe(PLACE_EMPTY.hours);
    expect(model.address).toBe(PLACE_EMPTY.address);
    expect(model.description).toBe(PLACE_EMPTY.description);
    expect(model.photosEmptyLabel).toBe(PLACE_EMPTY.photos);
    expect(model.callEmpty).toBe(true);
    expect(model.webEmpty).toBe(true);
    expect(model.openKind).toBe("unknown");
    expect(model.openLabel).toBe(PLACE_EMPTY.open);
    const html = placeCardHtml(model);
    expect(html).toContain("is-empty");
    expect(html).toContain(PLACE_EMPTY.photos);
    expect(html).toContain("aria-disabled");
  });

  it("shimmers photos and copy while place info is loading", () => {
    const store = LOOK_FIXTURES.stores.find((s) => s.brandKey === "walmart")!;
    const model = placeCardModel(store, undefined, { loading: true });
    expect(model.photosLoading).toBe(true);
    expect(model.descriptionLoading).toBe(true);
    const html = placeCardHtml(model);
    expect(html).toContain("look-photos is-loading");
    expect(html).toContain("look-desc is-loading");
  });
});
