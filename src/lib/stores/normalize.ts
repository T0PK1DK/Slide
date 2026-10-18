import { brandByName, brandByWikidata, brandLogoUrl, categoryColor, KNOWN_STORE_MODELS, slugify } from "./brands";
import type { Store, StoreCategory } from "./types";

export type OsmTags = Record<string, string>;

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

const CATEGORY_FROM_OSM: Array<{ test: (t: OsmTags) => boolean; category: StoreCategory }> = [
  { test: (t) => t.amenity === "fuel" || t.shop === "fuel", category: "fuel" },
  { test: (t) => t.amenity === "pharmacy" || t.healthcare === "pharmacy" || t.shop === "chemist", category: "pharmacy" },
  { test: (t) => t.amenity === "cafe" || t.cuisine === "coffee_shop" || t.shop === "coffee", category: "coffee" },
  { test: (t) => t.amenity === "fast_food", category: "fast_food" },
  { test: (t) => t.shop === "supermarket" || t.shop === "grocery" || t.shop === "greengrocer", category: "grocery" },
  { test: (t) => Boolean(t.shop) || t.amenity === "marketplace", category: "retail" },
];

export function categoryFromOsm(tags: OsmTags): StoreCategory {
  for (const row of CATEGORY_FROM_OSM) {
    if (row.test(tags)) return row.category;
  }
  return "other";
}

export function storeModelKey(brandKey: string, category: StoreCategory): string {
  return KNOWN_STORE_MODELS.includes(brandKey) ? brandKey : `generic-${category}`;
}

export function osmPoint(el: OsmElement): { lat: number; lon: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function tag(tags: OsmTags, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = tags[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function osmAddress(tags: OsmTags): string | undefined {
  const line = tag(tags, "addr:full");
  if (line) return line;
  const parts = [
    tag(tags, "addr:housenumber"),
    tag(tags, "addr:street"),
    tag(tags, "addr:unit"),
    tag(tags, "addr:city"),
    tag(tags, "addr:state"),
    tag(tags, "addr:postcode"),
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

/**
 * Map one OSM element to a Store. Uses brand:wikidata (NSI) first, then brand /
 * name aliases, then a slug of the brand or name.
 */
export function storeFromOsm(el: OsmElement): Store | null {
  const tags = el.tags ?? {};
  const pt = osmPoint(el);
  if (!pt) return null;
  const wikidata = tag(tags, "brand:wikidata", "operator:wikidata");
  const brandName = tag(tags, "brand", "operator");
  const name = tag(tags, "name", "brand") ?? "Store";
  const brand = brandByWikidata(wikidata) ?? brandByName(brandName) ?? brandByName(name);
  const category = brand?.category ?? categoryFromOsm(tags);
  const brandKey = brand?.brandKey ?? slugify(brandName ?? name);
  const displayBrand = brand?.name ?? brandName ?? name;
  const color = brand?.color ?? categoryColor(category);
  const logo = brand ? brandLogoUrl(brand) : undefined;
  const store: Store = {
    id: `osm:${el.type}/${el.id}`,
    name,
    brand: displayBrand,
    brandKey,
    category,
    lat: pt.lat,
    lon: pt.lon,
    color,
    modelKey: storeModelKey(brandKey, category),
  };
  const address = osmAddress(tags);
  const hours = tag(tags, "opening_hours");
  const phone = tag(tags, "phone", "contact:phone");
  const website = tag(tags, "website", "contact:website");
  if (address) store.address = address;
  if (hours) store.hours = hours;
  if (phone) store.phone = phone;
  if (website) store.website = website;
  if (logo) store.logo = logo;
  return store;
}

export function storesFromOverpass(json: { elements?: OsmElement[] }): Store[] {
  const seen = new Set<string>();
  const out: Store[] = [];
  for (const el of json.elements ?? []) {
    const s = storeFromOsm(el);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}
