import { afterEach, describe, expect, it } from "vitest";
import {
  classifyQuery,
  expandStreetAbbreviations,
  geocode,
  handleGeocodeRequest,
  hitsFromCensus,
  hitsFromNominatim,
  hitsFromPhoton,
  hnMatches,
  parseLatLng,
  pickResolved,
  preferNearBias,
  prettifyCensusAddress,
  resetNominatimGate,
  runGeocode,
  type GeocodeOpts,
} from "./geocode";
import type { SearchHit } from "./valhalla";

afterEach(() => resetNominatimGate());

const Q = {
  sixth: "1020 NW 6th Ave, Fort Lauderdale, FL",
  collins: "10201 Collins Ave, Bal Harbour, FL",
  shops: "Bal Harbour Shops",
  zip: "33154",
  corner: "Collins Ave and 96th St, Bal Harbour, FL",
} as const;

const PHOTON = {
  sixth: {
    features: [
      {
        geometry: { coordinates: [-80.1493137, 26.1236819] },
        properties: {
          name: "Fort Lauderdale Fire / Rescue Stations 2 and 8",
          street: "Northwest 6th Avenue",
          city: "Fort Lauderdale",
          state: "Florida",
        },
      },
      {
        geometry: { coordinates: [-80.1382448, 26.0827194] },
        properties: { name: "Southeast 6th Avenue", city: "Fort Lauderdale", state: "Florida" },
      },
    ],
  },
  collins: {
    features: [
      {
        geometry: { coordinates: [-80.1232997, 25.895148] },
        properties: {
          name: "Oceana Bal Harbour",
          street: "Collins Avenue",
          housenumber: "10201",
          city: "Bal Harbour Village",
          state: "Florida",
          osm_value: "apartments",
        },
      },
    ],
  },
  shops: {
    features: [
      {
        geometry: { coordinates: [-80.1249794, 25.8882233] },
        properties: {
          name: "Bal Harbour Shops",
          street: "Collins Avenue",
          housenumber: "9700",
          city: "Bal Harbour Village",
          state: "Florida",
        },
      },
    ],
  },
  zip: {
    features: [
      {
        geometry: { coordinates: [-80.12816223602064, 25.883125365011917] },
        properties: { name: "33154", city: "Bay Harbor Islands", state: "Florida" },
      },
      {
        geometry: { coordinates: [-6.1391834, 43.5521695] },
        properties: { name: "33154", city: "Cudillero", state: "Principality of Asturias" },
      },
      {
        geometry: { coordinates: [8.602507335944418, 51.67439215657764] },
        properties: { name: "33154", city: "Salzkotten", state: "North Rhine-Westphalia" },
      },
    ],
  },
  corner: {
    features: [
      {
        geometry: { coordinates: [-80.1249794, 25.8882233] },
        properties: {
          name: "Bal Harbour Shops",
          street: "Collins Avenue",
          housenumber: "9700",
          city: "Bal Harbour Village",
          state: "Florida",
        },
      },
    ],
  },
};

const NOMINATIM = {
  sixth: [
    {
      lat: "26.1371708",
      lon: "-80.1499068",
      display_name: "1020, Northwest 6th Avenue, Middle River Vista, Fort Lauderdale, Broward County, Florida, 33311, United States",
      name: "1020",
      type: "house",
      address: { house_number: "1020", road: "Northwest 6th Avenue", city: "Fort Lauderdale", state: "Florida", postcode: "33311" },
    },
  ],
  collins: [
    {
      lat: "25.8997839",
      lon: "-80.1246554",
      display_name: "Collins Avenue, Bal Harbour Village, Miami-Dade County, Florida, 33154, United States",
      name: "Collins Avenue",
      type: "road",
    },
  ],
  shops: [
    {
      lat: "25.8882233",
      lon: "-80.1249794",
      display_name: "Bal Harbour Shops, 9700, Collins Avenue, Bal Harbour Village, Miami-Dade County, Florida, 33154, United States",
      name: "Bal Harbour Shops",
      type: "mall",
    },
  ],
  zip: [
    {
      lat: "25.8831201",
      lon: "-80.1281677",
      display_name: "33154, Bay Harbor Islands, Miami-Dade County, Florida, United States",
      name: "33154",
      type: "postcode",
    },
    {
      lat: "51.6743922",
      lon: "8.6025073",
      display_name: "33154, Salzkotten, Kreis Paderborn, Nordrhein-Westfalen, Deutschland",
      name: "33154",
      type: "postcode",
    },
  ],
  corner: [] as unknown[],
};

const CENSUS = {
  sixth: {
    result: {
      addressMatches: [
        {
          matchedAddress: "1020 NW 6TH AVE, FORT LAUDERDALE, FL, 33311",
          coordinates: { x: -80.149932656475, y: 26.137130931592 },
          addressComponents: { fromAddress: "1020" },
        },
      ],
    },
  },
  collins: { result: { addressMatches: [] as unknown[] } },
  shops: { result: { addressMatches: [] as unknown[] } },
  zip: { result: { addressMatches: [] as unknown[] } },
  corner: {
    result: {
      addressMatches: [
        {
          matchedAddress: "COLLINS AVE & 96TH ST, BAL HARBOUR, FL, 33154",
          coordinates: { x: -80.122739962115, y: 25.887076015158 },
        },
      ],
    },
  },
};

const empty = { features: [], result: { addressMatches: [] as unknown[] } };

function jsonRes(body: unknown, ok = true): Promise<Response> {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 502,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as Response);
}

function mockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const q = (url.searchParams.get("q") ?? url.searchParams.get("address") ?? "").toLowerCase();
    const host = url.host;
    const pick = (bag: Record<string, unknown>) => {
      if (q.includes("1020") && q.includes("6th")) return bag.sixth;
      if (q.includes("10201") || q.includes("collins ave, bal")) return bag.collins;
      if (q.includes("bal harbour shops")) return bag.shops;
      if (q.trim() === "33154" || q.includes("33154")) return bag.zip;
      if (q.includes("96th") || q.includes("96th")) return bag.corner;
      return empty;
    };
    if (host.includes("photon")) return jsonRes(pick(PHOTON));
    if (host.includes("nominatim")) return jsonRes(pick(NOMINATIM));
    if (host.includes("census")) return jsonRes(pick(CENSUS));
    return jsonRes(empty);
  }) as typeof fetch;
}

const resolveOpts = (): GeocodeOpts => ({
  mode: "resolve",
  nominatim: true,
  nominatimMinMs: 0,
  fetch: mockFetch(),
  bias: { lon: -80.1918, lat: 25.7617 },
});

describe("query parsing", () => {
  it("reads lat,lng and only swaps when the first number cannot be a latitude", () => {
    expect(parseLatLng("26.13717, -80.14991")).toEqual({ lat: 26.13717, lon: -80.14991 });
    expect(parseLatLng("-122.4194, 37.7749")).toEqual({ lat: 37.7749, lon: -122.4194 });
    expect(parseLatLng("Bal Harbour")).toBeNull();
  });

  it("classifies the live test queries", () => {
    expect(classifyQuery(Q.sixth)).toBe("address");
    expect(classifyQuery(Q.collins)).toBe("address");
    expect(classifyQuery(Q.shops)).toBe("place");
    expect(classifyQuery(Q.zip)).toBe("zip");
    expect(classifyQuery(Q.corner)).toBe("intersection");
    expect(classifyQuery("25.8882, -80.1250")).toBe("coords");
  });

  it("expands NW / Ave so Photon can see the OSM name", () => {
    expect(expandStreetAbbreviations(Q.sixth)).toBe("1020 Northwest 6th Avenue, Fort Lauderdale, FL");
    expect(expandStreetAbbreviations(Q.collins)).toBe("10201 Collins Avenue, Bal Harbour, FL");
  });
});

describe("provider parsers + pick", () => {
  it("does not treat Photon's fire station as 1020 NW 6th Ave", () => {
    const hits = hitsFromPhoton(PHOTON.sixth);
    expect(hits[0].name).toMatch(/Fire/);
    expect(hnMatches(hits[0], Q.sixth)).toBe(false);
    expect(pickResolved(Q.sixth, hits)).toEqual([]);
  });

  it("keeps Photon when the house number is on the feature", () => {
    const hits = hitsFromPhoton(PHOTON.collins);
    expect(hnMatches(hits[0], Q.collins)).toBe(true);
    expect(pickResolved(Q.collins, hits)[0].lat).toBeCloseTo(25.895148, 5);
  });

  it("reads Nominatim house 1020 and Census ALL CAPS", () => {
    const nom = hitsFromNominatim(NOMINATIM.sixth);
    expect(nom[0]).toMatchObject({ housenumber: "1020", source: "nominatim", lon: -80.1499068 });
    const cen = hitsFromCensus(CENSUS.sixth);
    expect(cen[0].housenumber).toBe("1020");
    expect(cen[0].label).toBe("1020 NW 6th Ave, Fort Lauderdale, FL, 33311");
    expect(prettifyCensusAddress("COLLINS AVE & 96TH ST, BAL HARBOUR, FL, 33154")).toBe(
      "Collins Ave & 96th St, Bal Harbour, FL, 33154"
    );
  });

  it("ranks the US ZIP above the Spanish and German 33154s", () => {
    const ranked = preferNearBias(hitsFromPhoton(PHOTON.zip), { lon: -80.19, lat: 25.76 });
    expect(ranked[0].lon).toBeCloseTo(-80.12816, 4);
    expect(ranked.some((h) => h.lon > 0)).toBe(false);
  });
});

describe("resolve chain (King's test queries)", () => {
  it("1020 NW 6th Ave: Photon misses the house, Nominatim pins it", async () => {
    const [hit] = await runGeocode(Q.sixth, resolveOpts());
    expect(hit.source).toBe("nominatim");
    expect(hit.lat).toBeCloseTo(26.1371708, 5);
    expect(hit.lon).toBeCloseTo(-80.1499068, 5);
    expect(hit.label).toMatch(/1020/);
    expect(hit.label).toMatch(/Fort Lauderdale/);
  });

  it("10201 Collins Ave: Photon's Oceana house number is enough", async () => {
    const [hit] = await runGeocode(Q.collins, resolveOpts());
    expect(hit.source).toBe("photon");
    expect(hit.lat).toBeCloseTo(25.895148, 5);
    expect(hit.lon).toBeCloseTo(-80.1232997, 5);
    expect(hit.housenumber).toBe("10201");
  });

  it("Bal Harbour Shops: Photon place name", async () => {
    const [hit] = await runGeocode(Q.shops, resolveOpts());
    expect(hit.source).toBe("photon");
    expect(hit.name).toBe("Bal Harbour Shops");
    expect(hit.lat).toBeCloseTo(25.8882233, 5);
    expect(hit.lon).toBeCloseTo(-80.1249794, 5);
  });

  it("33154: ZIP centroid in Bay Harbor Islands, not Spain", async () => {
    const [hit] = await runGeocode(Q.zip, resolveOpts());
    expect(hit.source).toBe("photon");
    expect(hit.lat).toBeCloseTo(25.883125, 4);
    expect(hit.lon).toBeCloseTo(-80.128162, 4);
  });

  it("Collins Ave and 96th St: Census intersection", async () => {
    const [hit] = await runGeocode(Q.corner, resolveOpts());
    expect(hit.source).toBe("census");
    expect(hit.kind).toBe("intersection");
    expect(hit.lat).toBeCloseTo(25.887076, 4);
    expect(hit.lon).toBeCloseTo(-80.12274, 4);
  });

  it("falls through to Census when Nominatim is empty for the house", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.host.includes("photon")) return jsonRes(PHOTON.sixth);
      if (url.host.includes("nominatim")) return jsonRes([]);
      if (url.host.includes("census")) return jsonRes(CENSUS.sixth);
      return jsonRes(empty);
    }) as typeof fetch;
    const [hit] = await runGeocode(Q.sixth, { ...resolveOpts(), fetch: fetchImpl });
    expect(hit.source).toBe("census");
    expect(hit.lat).toBeCloseTo(26.1371309, 5);
    expect(hit.lon).toBeCloseTo(-80.1499327, 5);
  });

  it("typed lat,lng never hits a provider", async () => {
    const fetchImpl = (async () => {
      throw new Error("should not fetch");
    }) as unknown as typeof fetch;
    const [hit] = await runGeocode("25.88822, -80.12498", { fetch: fetchImpl });
    expect(hit).toMatchObject({ source: "coords", lat: 25.88822, lon: -80.12498 });
  });

  it("says nothing matched when every provider is empty", async () => {
    const fetchImpl = (async () => jsonRes(empty)) as typeof fetch;
    await expect(runGeocode("xyzzy nowhere 00000", { ...resolveOpts(), fetch: fetchImpl })).resolves.toEqual([]);
  });

  it("throws when every provider is unreachable", async () => {
    const fetchImpl = (async () => jsonRes({}, false)) as typeof fetch;
    await expect(runGeocode(Q.shops, { ...resolveOpts(), fetch: fetchImpl })).rejects.toBeTruthy();
  });

  it("suggest puts the Census house ahead of Photon's fire station", async () => {
    const hits = await runGeocode(Q.sixth, { ...resolveOpts(), mode: "suggest" });
    expect(hits[0].source).toBe("census");
    expect(hits[0].housenumber).toBe("1020");
    expect(hits.some((h) => h.name?.includes("Fire"))).toBe(true);
  });
});

describe("handleGeocodeRequest + geocode()", () => {
  it("parses the Pages Function query string", async () => {
    const url = `https://kings-slide.pages.dev/api/geocode?q=${encodeURIComponent(Q.sixth)}&mode=resolve&lat=25.76&lon=-80.19`;
    const { hits, error } = await handleGeocodeRequest(url, mockFetch());
    expect(error).toBeUndefined();
    expect(hits[0]?.lat).toBeCloseTo(26.1371708, 5);
  });

  it("geocode() in Node skips the /api hop and still resolves", async () => {
    const hit = await geocode("25.9, -80.13");
    expect(hit).toMatchObject({ source: "coords", lat: 25.9, lon: -80.13 });
  });
});

describe("SearchHit extras stay optional", () => {
  it("older callers can still treat a hit as label+lon+lat", () => {
    const hit: SearchHit = { label: "Home", lon: -80.1, lat: 25.8, kind: "saved" };
    expect(hit.housenumber).toBeUndefined();
  });
});
