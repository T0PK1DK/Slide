/** Chain store on the map. Grim paints pins; Leon picks `modelKey` for 3D. */

export const STORE_CATEGORIES = [
  "grocery",
  "pharmacy",
  "fuel",
  "fast_food",
  "coffee",
  "retail",
  "other",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export type Store = {
  id: string;
  name: string;
  brand: string;
  /** Lowercase slug, e.g. `"walmart"`. */
  brandKey: string;
  category: StoreCategory;
  lat: number;
  lon: number;
  address?: string;
  hours?: string;
  phone?: string;
  website?: string;
  /** Brand color table, `#rrggbb`. */
  color: string;
  logo?: string;
  /** `brandKey` when Leon has a model, else `"generic-"+category`. */
  modelKey: string;
};

export type Brand = {
  brandKey: string;
  name: string;
  color: string;
  /** Primary OSM / NSI `brand:wikidata` id. */
  wikidata: string;
  /** Extra Wikidata ids seen on OSM (operator, parent, old brand). */
  wikidataIds: readonly string[];
  category: StoreCategory;
  /** Lowercase names + NSI `brand` strings. */
  aliases: readonly string[];
  /** name-suggestion-index key, e.g. `shop/supermarket|Walmart`. */
  nsi?: string;
  /** Wikimedia Commons filename for a static logo URL. */
  logoFile?: string;
};

export type BBox = { s: number; w: number; n: number; e: number };
export type StoreTile = BBox & { key: string };
