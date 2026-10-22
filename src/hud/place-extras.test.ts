import { describe, expect, it } from "vitest";
import { PLACE_EMPTY } from "../look/empty";
import { placeExtrasEmpty, placeExtrasFrom, placeExtrasHtml } from "./place-extras";

describe("search place extras", () => {
  it("stays empty when Nard sent no hours, open flag, or photos", () => {
    const extras = placeExtrasFrom({});
    expect(placeExtrasEmpty(extras)).toBe(true);
    expect(extras.openLabel).toBeUndefined();
    expect(extras.hours).toBeUndefined();
    expect(placeExtrasHtml(extras)).toBe("");
  });

  it("uses posted hours and openNow, and never invents a chip", () => {
    const tue = new Date("2026-10-20T15:00:00");
    const open = placeExtrasFrom({ hours: "Mo-Su 06:00-23:00" }, { openNow: true }, tue);
    expect(open.hours).toBe("Daily 6a–11p");
    expect(open.openKind).toBe("open");
    expect(open.openLabel).toContain("closes 11p");
    const closed = placeExtrasFrom({ hours: "Mo-Fr 05:00-19:00" }, { openNow: false }, tue);
    expect(closed.openLabel).toBe("Opens 5a");
    const unknown = placeExtrasFrom({ hours: "24/7" });
    expect(unknown.openLabel).toBeUndefined();
    expect(unknown.hours).toBe("24/7");
  });

  it("keeps a Wikimedia logo first and a short credit", () => {
    const extras = placeExtrasFrom(
      {},
      {
        photos: [
          { url: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Storefront.jpg", credit: "Wikimedia Commons · lot.jpg" },
          {
            url: "https://commons.wikimedia.org/wiki/Special:FilePath/Publix_logo.svg",
            credit: "Wikimedia Commons · Publix_logo.svg",
            source: "wikidata",
          },
        ],
      },
    );
    expect(extras.photos[0]?.kind).toBe("logo");
    expect(extras.photos[0]?.caption).toBe(PLACE_EMPTY.logoCaption);
    const html = placeExtrasHtml(extras);
    expect(html).toContain("referrerpolicy=\"no-referrer\"");
    expect(html).toContain("look-photo-credit");
    expect(html).toContain("Wikimedia");
    expect(html).not.toContain("Publix_logo.svg</span>");
  });
});
