import { describe, expect, it, vi } from "vitest";
import { loadPlaceInfo, parseWikidataEntityPayload, placeInfoFromWikidata } from "./place-info";

const ENTITY = {
  id: "Q38076",
  descriptions: { en: { value: "American fast food restaurant chain" } },
  claims: {
    P856: [{ mainsnak: { datavalue: { value: "https://www.mcdonalds.com" } } }],
    P154: [{ mainsnak: { datavalue: { value: "McDonald's Golden Arches.svg" } } }],
    P18: [{ mainsnak: { datavalue: { value: "Burger King Whopper Meal.jpg" } } }],
  },
};

describe("place info", () => {
  it("reads Wikidata description, site, and Commons photos with credit", () => {
    const info = placeInfoFromWikidata("osm:node/123", ENTITY, {
      hours: "24/7",
      at: new Date(2026, 9, 18, 12, 0, 0),
    });
    expect(info.storeId).toBe("osm:node/123");
    expect(info.description).toMatch(/fast food/i);
    expect(info.website).toBe("https://www.mcdonalds.com");
    expect(info.openNow).toBe(true);
    expect(info.photos).toHaveLength(2);
    expect(info.photos[0]).toMatchObject({
      source: "wikidata",
      credit: expect.stringContaining("Wikimedia Commons"),
    });
    expect(info.photos[0].url).toContain("Special:FilePath");
  });

  it("keeps OSM website / hours when Wikidata is missing, and never invents copy", () => {
    const info = placeInfoFromWikidata("osm:node/1", {}, { website: "https://publix.com", hours: "Mo-Su 07:00-22:00", at: new Date(2026, 9, 18, 8, 0, 0) });
    expect(info.description).toBeUndefined();
    expect(info.photos).toEqual([]);
    expect(info.website).toBe("https://publix.com");
    expect(info.openNow).toBe(true);
  });

  it("unwraps EntityData and caches the assembled PlaceInfo", async () => {
    expect(parseWikidataEntityPayload({ entities: { Q38076: ENTITY } }, "Q38076")).toEqual(ENTITY);
    const cache = new Map<string, Response>();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ entities: { Q38076: ENTITY } })));
    const first = await loadPlaceInfo(
      { storeId: "osm:node/9", wikidata: "Q38076", hours: "24/7" },
      {
        fetch: fetchMock as unknown as typeof fetch,
        cache: {
          match: async (req) => cache.get(req.url),
          put: async (req, res) => { cache.set(req.url, res.clone()); },
        },
        at: new Date(2026, 9, 18, 12, 0, 0),
      },
    );
    expect(first.photos.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const second = await loadPlaceInfo(
      { storeId: "osm:node/9", wikidata: "Q38076" },
      {
        fetch: fetchMock as unknown as typeof fetch,
        cache: { match: async (req) => cache.get(req.url), put: async () => undefined },
      },
    );
    expect(second.description).toBe(first.description);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
