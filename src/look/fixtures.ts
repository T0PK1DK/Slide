import { samplePhoto } from "./photos";
import type { Ghost, PlaceInfo, Store } from "./types";

/**
 * Local look-only fixtures in Nard's shape. Swap for `loadStoresNear` +
 * `fetchPlaceInfo` + `watchLiveGhosts` after his backend PR merges.
 * See docs/LOOK.md.
 */

export type LookFixtures = {
  stores: Store[];
  places: Record<string, PlaceInfo>;
  ghosts: Ghost[];
  /** Destination used by the “at destination” demo trigger. */
  destinationId: string;
};

const walmart: Store = {
  id: "osm:node/123",
  name: "Walmart Supercenter",
  brand: "Walmart",
  brandKey: "walmart",
  category: "grocery",
  lat: 26.1228,
  lon: -80.138,
  address: "1200 S Federal Hwy",
  hours: "Mo-Su 06:00-23:00",
  phone: "+1 954-555-0100",
  website: "https://www.walmart.com",
  color: "#0071ce",
  modelKey: "walmart",
};

const target: Store = {
  id: "osm:node/target-1",
  name: "Target",
  brand: "Target",
  brandKey: "target",
  category: "retail",
  lat: 26.124,
  lon: -80.1412,
  address: "1400 N Federal Hwy, Fort Lauderdale",
  hours: "Mo-Sa 08:00-22:00; Su 08:00-21:00",
  phone: "+1 954-555-0140",
  website: "https://www.target.com",
  color: "#cc0000",
  modelKey: "target",
};

const starbucks: Store = {
  id: "osm:node/sbx-1",
  name: "Starbucks",
  brand: "Starbucks",
  brandKey: "starbucks",
  category: "coffee",
  lat: 26.1235,
  lon: -80.1338,
  address: "201 Las Olas Blvd",
  hours: "Mo-Fr 05:30-21:00; Sa-Su 06:00-21:00",
  website: "https://www.starbucks.com",
  color: "#00704a",
  modelKey: "starbucks",
};

const mcdonalds: Store = {
  id: "osm:node/mcd-1",
  name: "McDonald's",
  brand: "McDonald's",
  brandKey: "mcdonalds",
  category: "fast_food",
  lat: 26.1212,
  lon: -80.132,
  address: "30 SE 2nd St",
  hours: "Mo-Su 00:00-24:00",
  phone: "+1 954-555-0188",
  color: "#ffc72c",
  modelKey: "mcdonalds",
};

const publix: Store = {
  id: "osm:node/publix-1",
  name: "Publix Super Market",
  brand: "Publix",
  brandKey: "publix",
  category: "grocery",
  lat: 26.1205,
  lon: -80.1355,
  address: "911 E Las Olas Blvd",
  hours: "Mo-Su 07:00-22:00",
  color: "#3d8b37",
  modelKey: "publix",
};

const cvs: Store = {
  id: "osm:node/cvs-1",
  name: "CVS Pharmacy",
  brand: "CVS",
  brandKey: "cvs",
  category: "pharmacy",
  lat: 26.119,
  lon: -80.14,
  phone: "+1 954-555-0112",
  color: "#cc0000",
  modelKey: "cvs",
};

const dunkin: Store = {
  id: "osm:node/dunkin-1",
  name: "Dunkin'",
  brand: "Dunkin'",
  brandKey: "dunkin",
  category: "coffee",
  lat: 26.1218,
  lon: -80.1425,
  address: "640 W Broward Blvd",
  hours: "Mo-Fr 05:00-19:00",
  color: "#e11383",
  modelKey: "generic-coffee",
};

/** Nard's unknown-chain sample: color + generic model, almost no extras. */
const kroger: Store = {
  id: "osm:node/99",
  name: "Kroger",
  brand: "Kroger",
  brandKey: "kroger",
  category: "grocery",
  lat: 26.126,
  lon: -80.139,
  color: "#0066b2",
  modelKey: "generic-grocery",
};

/** Missing nearly everything — empty-state showcase. */
const corner: Store = {
  id: "osm:node/corner-1",
  name: "Corner Mart",
  category: "other",
  lat: 26.1252,
  lon: -80.134,
  modelKey: "generic-other",
};

const shell: Store = {
  id: "osm:node/shell-1",
  name: "Shell",
  brand: "Shell",
  brandKey: "shell",
  category: "fuel",
  lat: 26.1188,
  lon: -80.1362,
  address: "SE 3rd Ave",
  hours: "Mo-Su 00:00-24:00",
  color: "#ffd100",
  modelKey: "shell",
};

const bp: Store = {
  id: "osm:node/bp-1",
  name: "BP",
  brand: "BP",
  brandKey: "bp",
  category: "fuel",
  lat: 26.1186,
  lon: -80.1358,
  color: "#00a651",
  modelKey: "generic-fuel",
};

const chevron: Store = {
  id: "osm:node/chevron-1",
  name: "Chevron",
  brand: "Chevron",
  brandKey: "chevron",
  category: "fuel",
  lat: 26.1184,
  lon: -80.1366,
  color: "#ed1c24",
  modelKey: "generic-fuel",
};

export const LOOK_STORES: Store[] = [
  walmart,
  target,
  starbucks,
  mcdonalds,
  publix,
  cvs,
  dunkin,
  kroger,
  corner,
  shell,
  bp,
  chevron,
];

export const LOOK_PLACES: Record<string, PlaceInfo> = {
  [walmart.id!]: {
    storeId: walmart.id,
    description: "A full-line grocery and general store. Sample copy for the look pass — Nard will swap in Wikidata.",
    photos: [
      samplePhoto("facade", "Front lot"),
      samplePhoto("aisle", "Aisles"),
      samplePhoto("lot", "Evening lot"),
    ],
    openNow: true,
    website: "https://www.walmart.com",
  },
  [target.id!]: {
    storeId: target.id,
    description: "Red-disc retail, open late most days.",
    photos: [samplePhoto("facade", "Entry"), samplePhoto("aisle", "Floor")],
    openNow: true,
    website: "https://www.target.com",
  },
  [starbucks.id!]: {
    storeId: starbucks.id,
    description: "Corner coffee. Quiet tables after the morning rush.",
    photos: [samplePhoto("facade", "Corner cafe")],
    openNow: true,
  },
  [mcdonalds.id!]: {
    storeId: mcdonalds.id,
    openNow: true,
    photos: [samplePhoto("lot", "Drive-thru")],
  },
  [publix.id!]: {
    storeId: publix.id,
    openNow: true,
    photos: [],
  },
  [cvs.id!]: {
    storeId: cvs.id,
    openNow: false,
    photos: [],
  },
  [dunkin.id!]: {
    storeId: dunkin.id,
    openNow: false,
    photos: [samplePhoto("facade", "Storefront")],
  },
  [shell.id!]: {
    storeId: shell.id,
    openNow: true,
    photos: [samplePhoto("pump", "Pumps")],
    description: "Fuel on the block. Clustered with BP and Chevron to prove declutter.",
  },
};

export const LOOK_GHOSTS: Ghost[] = [
  {
    userId: "11111111-1111-1111-1111-111111111111",
    displayName: "King",
    carModelKey: "slipstream",
    color: "#f0a04b",
    lat: 26.122,
    lon: -80.1375,
    headingDeg: 42,
    speedMps: 12.4,
    updatedAt: 1760812800000,
  },
  {
    userId: "22222222-2222-2222-2222-222222222222",
    displayName: "Mira",
    carModelKey: "hatch",
    color: "#7cf0d8",
    position: { lat: 26.1232, lon: -80.136 },
    headingDeg: 185,
    speedMps: 8.1,
    updatedAt: 1760812800000,
  },
  {
    userId: "33333333-3333-3333-3333-333333333333",
    displayName: "Rio",
    carModelKey: "brawler",
    color: "#5b8cff",
    lat: 26.1208,
    lon: -80.1388,
    headingDeg: 310,
    speedMps: 15.2,
    updatedAt: 1760812800000,
  },
];

export const LOOK_FIXTURES: LookFixtures = {
  stores: LOOK_STORES,
  places: LOOK_PLACES,
  ghosts: LOOK_GHOSTS,
  destinationId: walmart.id!,
};

export function placeFor(store: Store, places: Record<string, PlaceInfo> = LOOK_PLACES): PlaceInfo | undefined {
  const id = store.id;
  if (!id) return undefined;
  return places[id];
}

/**
 * After Nard's PR: pass through his Store / PlaceInfo / Ghost arrays.
 * Extra fields are ignored; missing ones stay empty in the card.
 */
export function lookDataFromNard(
  stores: Store[],
  places: PlaceInfo[],
  ghosts: Ghost[],
): LookFixtures {
  const byId: Record<string, PlaceInfo> = {};
  for (const p of places) {
    if (p.storeId) byId[p.storeId] = p;
  }
  return {
    stores,
    places: byId,
    ghosts,
    destinationId: stores[0]?.id ?? "",
  };
}
