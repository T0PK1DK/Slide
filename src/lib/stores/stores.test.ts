import { afterEach, describe, expect, it, vi } from "vitest";
import { BRANDS, brandByName, brandByWikidata, commonsFileUrl, KNOWN_STORE_MODELS, slugify } from "./brands";
import { loadStoresForRequest, parseStoresRequest, tilesForRequest } from "./handler";
import { openNow } from "./hours";
import { storeFromOsm, storeModelKey, storesFromOverpass } from "./normalize";
import { backoffMs, storeTile, storesOverpassQuery, tilesForBbox, tilesForRoute } from "./overpass";

describe("brand table", () => {
  it("ships about 30 major US chains with key, name, color, wikidata", () => {
    expect(BRANDS.length).toBeGreaterThanOrEqual(30);
    expect(BRANDS.length).toBeLessThanOrEqual(36);
    const keys = new Set(BRANDS.map((b) => b.brandKey));
    expect(keys.size).toBe(BRANDS.length);
    for (const b of BRANDS) {
      expect(b.brandKey).toMatch(/^[a-z0-9-]+$/);
      expect(b.name.length).toBeGreaterThan(1);
      expect(b.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(b.wikidata).toMatch(/^Q\d+$/);
      expect(b.wikidataIds).toContain(b.wikidata);
    }
  });
});

describe("brand normalization", () => {
  it("prefers brand:wikidata (NSI) over a conflicting name", () => {
    const s = storeFromOsm({
      type: "node",
      id: 123,
      lat: 26.12,
      lon: -80.14,
      tags: { name: "Neighborhood Market", brand: "Something Else", "brand:wikidata": "Q483551" },
    });
    expect(s).toMatchObject({
      id: "osm:node/123",
      brandKey: "walmart",
      brand: "Walmart",
      category: "grocery",
      color: "#0071ce",
    });
  });

  it("matches OSM / NSI brand names and aliases", () => {
    expect(brandByName("Wal-Mart")?.brandKey).toBe("walmart");
    expect(brandByName("Trader Joe's")?.brandKey).toBe("trader-joes");
    expect(brandByName("Dunkin' Donuts")?.brandKey).toBe("dunkin");
    expect(brandByName("Chick-fil-A")?.brandKey).toBe("chick-fil-a");
    expect(brandByWikidata("Q38076")?.brandKey).toBe("mcdonalds");
    expect(brandByWikidata("Q41171391")?.brandKey).toBe("aldi");
    const s = storeFromOsm({
      type: "way",
      id: 9,
      center: { lat: 25.8, lon: -80.2 },
      tags: { name: "Publix Super Market", brand: "Publix", shop: "supermarket" },
    });
    expect(s).toMatchObject({ id: "osm:way/9", brandKey: "publix", category: "grocery" });
  });

  it("slugs an unknown brand and reads OSM contact tags", () => {
    const s = storeFromOsm({
      type: "node",
      id: 7,
      lat: 25.77,
      lon: -80.19,
      tags: {
        name: "Joe's Fuel",
        brand: "Joe's Fuel",
        amenity: "fuel",
        "addr:housenumber": "100",
        "addr:street": "Main St",
        opening_hours: "24/7",
        phone: "+1 305 555 0100",
        website: "https://example.invalid",
      },
    });
    expect(s).toMatchObject({
      brandKey: "joes-fuel",
      category: "fuel",
      address: "100 Main St",
      hours: "24/7",
      website: "https://example.invalid",
    });
    expect(s?.color).toBe("#ffd100");
    expect(slugify("Trader Joe's")).toBe("trader-joes");
  });
});

describe("modelKey fallback", () => {
  it("uses the brand key when Leon has a model, else generic-category", () => {
    expect(KNOWN_STORE_MODELS).toContain("walmart");
    expect(storeModelKey("walmart", "grocery")).toBe("walmart");
    expect(storeModelKey("kroger", "grocery")).toBe("generic-grocery");
    expect(storeModelKey("joes-fuel", "fuel")).toBe("generic-fuel");
    const unknown = storeFromOsm({
      type: "node",
      id: 1,
      lat: 25.8,
      lon: -80.2,
      tags: { name: "Kroger", shop: "supermarket" },
    });
    expect(unknown?.modelKey).toBe("generic-grocery");
    const known = storeFromOsm({
      type: "node",
      id: 2,
      lat: 25.8,
      lon: -80.2,
      tags: { name: "Walmart", "brand:wikidata": "Q483551" },
    });
    expect(known?.modelKey).toBe("walmart");
    expect(known?.logo).toBe(commonsFileUrl("Walmart_logo.svg"));
  });
});

describe("Overpass tiling and backoff", () => {
  it("tiles a view and a route, and caps huge boxes", () => {
    const t = storeTile(25.77, -80.19);
    expect(t.key).toMatch(/25\.\d_-80\.\d/);
    expect(tilesForBbox({ s: 25.7, w: -80.3, n: 25.9, e: -80.1 }).length).toBeGreaterThan(1);
    const route = tilesForRoute([
      [-80.2, 25.76],
      [-80.19, 25.77],
      [-80.05, 25.95],
    ]);
    expect(route.length).toBeGreaterThanOrEqual(2);
    const q = storesOverpassQuery(t);
    expect(q).toContain("brand:wikidata");
    expect(q).toContain("Q483551");
    expect(q).toContain("out center tags");
  });

  it("backs off on 429 / 504 and honors Retry-After", () => {
    expect(backoffMs(0, 429, 3)).toBe(3000);
    expect(backoffMs(0, 429)).toBe(800);
    expect(backoffMs(2, 504)).toBe(3200);
    expect(backoffMs(0)).toBe(400);
  });

  it("parses the Function query and filters to the requested km", async () => {
    expect(parseStoresRequest("https://x/api/stores")).toEqual({ error: "lat and lon required" });
    const parsed = parseStoresRequest("https://x/api/stores?lat=25.77&lon=-80.19&km=4");
    expect(parsed).toMatchObject({ lat: 25.77, lon: -80.19, km: 4 });
    expect(tilesForRequest(parsed as { lat: number; lon: number; km: number }).length).toBeGreaterThan(0);

    const cache = new Map<string, Response>();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        elements: [
          { type: "node", id: 1, lat: 25.7701, lon: -80.1901, tags: { name: "Walmart", "brand:wikidata": "Q483551" } },
          { type: "node", id: 2, lat: 26.5, lon: -80.2, tags: { name: "Target", brand: "Target" } },
        ],
      })),
    );
    const { items } = await loadStoresForRequest(
      { lat: 25.77, lon: -80.19, km: 5 },
      {
        fetch: fetchMock,
        sleep: async () => undefined,
        cache: {
          match: async (req) => cache.get(req.url),
          put: async (req, res) => { cache.set(req.url, res.clone()); },
        },
      },
    );
    expect(items.map((s) => s.id)).toEqual(["osm:node/1"]);
    expect(fetchMock).toHaveBeenCalled();
    const again = await loadStoresForRequest(
      { lat: 25.77, lon: -80.19, km: 5 },
      { fetch: fetchMock, cache: { match: async (req) => cache.get(req.url), put: async () => undefined } },
    );
    expect(again.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(tilesForRequest({ lat: 25.77, lon: -80.19, km: 5 }).length);
  });

  it("retries a 429 then succeeds", async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n += 1;
      if (n === 1) return new Response("slow", { status: 429, headers: { "retry-after": "0" } });
      return new Response(JSON.stringify({
        elements: [{ type: "node", id: 3, lat: 25.77, lon: -80.19, tags: { name: "Starbucks", "brand:wikidata": "Q37158" } }],
      }));
    });
    const { items } = await loadStoresForRequest(
      { lat: 25.77, lon: -80.19, km: 2 },
      { fetch: fetchMock, sleep: async () => undefined },
    );
    expect(items[0]?.brandKey).toBe("starbucks");
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

describe("opening hours", () => {
  it("reads 24/7, weekday windows, and overnight spans", () => {
    const tue10 = new Date(2026, 9, 13, 10, 0, 0); // Tuesday
    const tue23 = new Date(2026, 9, 13, 23, 0, 0);
    const sat8 = new Date(2026, 9, 17, 8, 0, 0);
    expect(openNow("24/7", tue10)).toBe(true);
    expect(openNow("Mo-Fr 08:00-22:00", tue10)).toBe(true);
    expect(openNow("Mo-Fr 08:00-22:00", tue23)).toBe(false);
    expect(openNow("Mo-Fr 08:00-22:00", sat8)).toBe(false);
    expect(openNow("Mo-Su 22:00-02:00", tue23)).toBe(true);
    expect(openNow(undefined, tue10)).toBeUndefined();
  });
});

describe("overpass mapping", () => {
  it("dedupes elements and skips nodes without a point", () => {
    const items = storesFromOverpass({
      elements: [
        { type: "node", id: 1, lat: 25.8, lon: -80.2, tags: { name: "Target", brand: "Target" } },
        { type: "node", id: 1, lat: 25.8, lon: -80.2, tags: { name: "Target", brand: "Target" } },
        { type: "way", id: 4, tags: { name: "No geom" } },
      ],
    });
    expect(items).toHaveLength(1);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
