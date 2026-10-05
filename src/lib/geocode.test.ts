import { afterEach, describe, expect, it } from "vitest";
import {
  censusQuery,
  expandStreetQuery,
  fallbackPlaces,
  hitsFromCensus,
  hitsFromNominatim,
  hitsFromPhoton,
  isIntersection,
  isZip,
  leadingHouse,
  looksCompleteQuery,
  NO_MATCH,
  parseLatLng,
  rankHits,
  resetNominatimClock,
  resultsSatisfied,
  searchPlaces,
} from "./geocode";

const FLL = { lon: -80.1918, lat: 25.7617 };

const PHOTON_1020 = {
  features: [
    {
      geometry: { coordinates: [-80.1493137, 26.1236819] },
      properties: {
        osm_value: "fire_station",
        name: "Fort Lauderdale Fire / Rescue Stations 2 and 8",
        street: "Northwest 6th Avenue",
        city: "Fort Lauderdale",
        state: "Florida",
      },
    },
  ],
};
const NOMINATIM_1020 = [
  {
    addresstype: "place",
    type: "house",
    lat: "26.1371698",
    lon: "-80.1499048",
    display_name: "1020, Northwest 6th Avenue, Fort Lauderdale, Florida, 33311, United States",
    address: { house_number: "1020", road: "Northwest 6th Avenue", city: "Fort Lauderdale", state: "Florida" },
  },
];
const CENSUS_1020 = {
  result: {
    addressMatches: [
      { matchedAddress: "1020 NW 6TH AVE, FORT LAUDERDALE, FL, 33311", coordinates: { x: -80.149932656475, y: 26.137130931592 } },
    ],
  },
};
const PHOTON_10201 = {
  features: [
    {
      geometry: { coordinates: [-80.1232997, 25.895148] },
      properties: {
        osm_value: "residential",
        housenumber: "10201",
        name: "Oceana Bal Harbour",
        street: "Collins Avenue",
        city: "Bal Harbour Village",
        state: "Florida",
      },
    },
  ],
};
const PHOTON_SHOPS = {
  features: [
    {
      geometry: { coordinates: [-80.1249794, 25.8882233] },
      properties: {
        osm_value: "mall",
        housenumber: "9700",
        name: "Bal Harbour Shops",
        street: "Collins Avenue",
        city: "Bal Harbour Village",
        state: "Florida",
      },
    },
  ],
};
const PHOTON_ZIP = {
  features: [
    {
      geometry: { coordinates: [-80.12816223602064, 25.883125365011917] },
      properties: { osm_value: "postcode", type: "postcode", name: "33154", city: "Bay Harbor Islands", state: "Florida" },
    },
    {
      geometry: { coordinates: [-6.1391834, 43.5521695] },
      properties: { osm_value: "postcode", type: "postcode", name: "33154", city: "Cudillero", state: "Principality of Asturias" },
    },
  ],
};
const CENSUS_INTERSECTION = {
  result: {
    addressMatches: [
      { matchedAddress: "NW 6TH AVE & W BROWARD BLVD, FORT LAUDERDALE, FL, 33311", coordinates: { x: -80.149530019332, y: 26.122269016118 } },
    ],
  },
};
const EMPTY_PHOTON = { features: [] };
const EMPTY_CENSUS = { result: { addressMatches: [] } };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function mockFetch(routes: {
  photon?: unknown;
  nominatim?: unknown;
  census?: unknown;
  photonByQ?: Record<string, unknown>;
}): { fetch: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input), "http://local.test");
    urls.push(url.href);
    if (url.hostname.includes("photon")) {
      const q = url.searchParams.get("q") ?? "";
      if (routes.photonByQ && q in routes.photonByQ) return json(routes.photonByQ[q]);
      return json(routes.photon ?? EMPTY_PHOTON);
    }
    if (url.hostname.includes("nominatim")) return json(routes.nominatim ?? []);
    if (url.hostname.includes("census.gov")) return json(routes.census ?? EMPTY_CENSUS);
    throw new Error(`unexpected ${url.href}`);
  };
  return { fetch: fetchFn, urls };
}

afterEach(() => resetNominatimClock());

describe("query parsing", () => {
  it("reads lat,lng and ignores bare integers", () => {
    expect(parseLatLng("26.13717, -80.14990")).toMatchObject({ lat: 26.13717, lon: -80.1499, kind: "coordinates" });
    expect(parseLatLng("26.13717,-80.14990")?.lat).toBe(26.13717);
    expect(parseLatLng("33154")).toBeNull();
    expect(parseLatLng("1020 NW 6th Ave, Fort Lauderdale, FL")).toBeNull();
  });

  it("expands NW / Ave / FL without touching house numbers", () => {
    expect(expandStreetQuery("1020 NW 6th Ave, Fort Lauderdale, FL")).toBe(
      "1020 Northwest 6th Avenue, Fort Lauderdale, Florida"
    );
    expect(censusQuery("NW 6th Ave and Broward Blvd, Fort Lauderdale, FL")).toBe(
      "NW 6th Ave & Broward Blvd, Fort Lauderdale, FL"
    );
  });

  it("spots zips, intersections and house numbers", () => {
    expect(isZip("33154")).toBe(true);
    expect(isZip("1020 NW 6th Ave")).toBe(false);
    expect(isIntersection("NW 6th Ave and Broward Blvd, Fort Lauderdale")).toBe(true);
    expect(isIntersection("Collins Ave & 96th St, Bal Harbour, FL")).toBe(true);
    expect(isIntersection("Bal Harbour Shops")).toBe(false);
    expect(leadingHouse("1020 NW 6th Ave, Fort Lauderdale, FL")).toBe("1020");
    expect(leadingHouse("10201 Collins Ave, Bal Harbour, FL")).toBe("10201");
    expect(leadingHouse("6th Ave")).toBeNull();
    expect(looksCompleteQuery("1020 NW 6th Ave, Fort Lauderdale, FL")).toBe(true);
    expect(looksCompleteQuery("1020 NW")).toBe(false);
    expect(NO_MATCH).toBe("No match, try adding city");
  });
});

describe("provider mappers", () => {
  it("does not treat a Photon POI on the same street as house 1020", () => {
    const hits = hitsFromPhoton(PHOTON_1020);
    expect(resultsSatisfied("1020 NW 6th Ave, Fort Lauderdale, FL", hits)).toBe(false);
    expect(hits[0].kind).toBe("fire_station");
  });

  it("reads Nominatim and Census house matches", () => {
    const nom = hitsFromNominatim(NOMINATIM_1020);
    expect(nom[0]).toMatchObject({ lat: 26.1371698, lon: -80.1499048 });
    expect(resultsSatisfied("1020 NW 6th Ave, Fort Lauderdale, FL", nom)).toBe(true);
    const census = hitsFromCensus(CENSUS_1020);
    expect(census[0].label).toMatch(/1020 NW 6th Ave/i);
    expect(census[0].lat).toBeCloseTo(26.13713, 4);
  });
});

describe("searchPlaces — King's queries", () => {
  const q1020 = "1020 NW 6th Ave, Fort Lauderdale, FL";
  const q10201 = "10201 Collins Ave, Bal Harbour, FL";
  const qShops = "Bal Harbour Shops";
  const qZip = "33154";
  const qCross = "NW 6th Ave and Broward Blvd, Fort Lauderdale, FL";

  it("geocodes 1020 NW 6th Ave, Fort Lauderdale, FL via Census after Photon misses the house", async () => {
    const { fetch, urls } = mockFetch({ photon: PHOTON_1020, census: CENSUS_1020, nominatim: [] });
    const hits = await searchPlaces(q1020, FLL, { intent: "resolve", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits[0].lat).toBeCloseTo(26.137130931592, 5);
    expect(hits[0].lon).toBeCloseTo(-80.149932656475, 5);
    expect(hits[0].label).toMatch(/1020/i);
    expect(urls.some((u) => u.includes("photon.komoot.io"))).toBe(true);
    expect(urls.some((u) => u.includes("census.gov"))).toBe(true);
  });

  it("falls through to Nominatim when Census has no match for that house", async () => {
    const { fetch } = mockFetch({ photon: PHOTON_1020, census: EMPTY_CENSUS, nominatim: NOMINATIM_1020 });
    const hits = await searchPlaces(q1020, FLL, { intent: "resolve", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits[0].lat).toBeCloseTo(26.1371698, 5);
    expect(hits[0].lon).toBeCloseTo(-80.1499048, 5);
  });

  it("keeps Photon's 10201 Collins Ave, Bal Harbour, FL and does not call Census", async () => {
    const { fetch, urls } = mockFetch({ photon: PHOTON_10201, census: EMPTY_CENSUS, nominatim: [] });
    const hits = await searchPlaces(q10201, FLL, { intent: "resolve", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits[0].lat).toBeCloseTo(25.895148, 5);
    expect(hits[0].lon).toBeCloseTo(-80.1232997, 5);
    expect(hits[0].label).toMatch(/10201/);
    expect(urls.some((u) => u.includes("census.gov"))).toBe(false);
    expect(urls.some((u) => u.includes("nominatim"))).toBe(false);
  });

  it("finds Bal Harbour Shops as a place name", async () => {
    const { fetch } = mockFetch({ photon: PHOTON_SHOPS });
    const hits = await searchPlaces(qShops, FLL, { intent: "suggest", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits[0].name).toBe("Bal Harbour Shops");
    expect(hits[0].lat).toBeCloseTo(25.8882233, 5);
    expect(hits[0].lon).toBeCloseTo(-80.1249794, 5);
  });

  it("resolves ZIP 33154 near Miami, not the Spanish 33154", async () => {
    const { fetch } = mockFetch({ photon: PHOTON_ZIP });
    const hits = await searchPlaces(qZip, FLL, { intent: "resolve", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits[0].label).toMatch(/Bay Harbor Islands/);
    expect(hits[0].lat).toBeCloseTo(25.883125, 4);
    expect(hits[0].lon).toBeCloseTo(-80.12816, 4);
    expect(hits[0].lat).not.toBeCloseTo(43.55, 0);
  });

  it("resolves an intersection through the Census geocoder", async () => {
    const { fetch } = mockFetch({ photon: PHOTON_1020, census: CENSUS_INTERSECTION, nominatim: [] });
    const hits = await searchPlaces(qCross, FLL, { intent: "resolve", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits[0].kind).toBe("intersection");
    expect(hits[0].lat).toBeCloseTo(26.122269016118, 5);
    expect(hits[0].lon).toBeCloseTo(-80.149530019332, 5);
    expect(hits[0].label).toMatch(/&/);
  });

  it("returns coordinates for a typed lat,lng without fetching", async () => {
    const { fetch, urls } = mockFetch({});
    const hits = await searchPlaces("26.13717, -80.14990", FLL, { intent: "resolve", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("coordinates");
    expect(hits[0].lat).toBeCloseTo(26.13717, 5);
    expect(urls).toEqual([]);
  });

  it("returns no pin when a house number never matches, instead of a nearby POI", async () => {
    const { fetch } = mockFetch({ photon: PHOTON_1020, census: EMPTY_CENSUS, nominatim: [] });
    const hits = await searchPlaces(q1020, FLL, { intent: "resolve", fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits).toEqual([]);
  });
});

describe("rankHits", () => {
  it("prefers a house match over a closer POI", () => {
    const ranked = rankHits("1020 NW 6th Ave, Fort Lauderdale, FL", [
      { label: "Fort Lauderdale Fire / Rescue, Northwest 6th Avenue, Fort Lauderdale", lon: -80.14931, lat: 26.12368, kind: "fire_station" },
      { label: "1020, Northwest 6th Avenue, Fort Lauderdale", lon: -80.14990, lat: 26.13717, kind: "house" },
    ], FLL);
    expect(ranked[0].label).toMatch(/^1020/);
  });
});

describe("fallbackPlaces", () => {
  it("uses Census for a US street when called from the Worker (no proxy)", async () => {
    const { fetch } = mockFetch({ census: CENSUS_1020, nominatim: [] });
    const hits = await fallbackPlaces("1020 NW 6th Ave, Fort Lauderdale, FL", FLL, "suggest", { fetch, proxy: "", nominatimGapMs: 0 });
    expect(hits[0].lat).toBeCloseTo(26.13713, 4);
  });
});
