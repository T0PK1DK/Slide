import { describe, expect, it } from "vitest";
import { SEARCH } from "../lib/empty";
import { recentsListHtml, savedPlaceRow, savedRowInnerHtml } from "./search-rows";

describe("search saved rows", () => {
  it("splits a recent into the same two lines as suggest", () => {
    const row = savedPlaceRow("401, Bayside Marketplace, Biscayne Blvd, Miami", "recent");
    expect(row.name).toBe("Bayside Marketplace");
    expect(row.address).toContain("Biscayne");
    expect(row.address).not.toBe(row.name);
  });

  it("keeps Home / Work titles and empty copy", () => {
    expect(savedPlaceRow("", "home", true)).toEqual({ name: "Home", address: "Save a place on this phone" });
    expect(savedPlaceRow("9601 Collins Ave, Miami Beach", "work").name).toBe("Work");
    expect(savedPlaceRow("Home", "recent").address).toBe("Saved on this phone");
  });

  it("renders recents as buttons and an idle line when the list is empty", () => {
    const empty = recentsListHtml([]);
    expect(empty).toContain("recents-label");
    expect(empty).toContain(SEARCH.idle);
    expect(empty).not.toContain("recent-item");
    const html = recentsListHtml([{ label: "Bayside Marketplace, Miami", lon: -80.18, lat: 25.77 }]);
    expect(html).toContain("recent-item");
    expect(html).toContain("data-label=");
    expect(html).toContain("suggest-name");
    expect(savedRowInnerHtml({ name: "A", address: "B" })).toContain("suggest-addr");
    expect(recentsListHtml([{ label: `<Church & "Hall">`, lon: 0, lat: 0 }])).toContain("&lt;Church &amp; &quot;Hall&quot;&gt;");
  });
});
