import type { Brand, StoreCategory } from "./types";

/**
 * ~30 major US chains. Matching uses `brand:wikidata` first (name-suggestion-index
 * / OSM), then `brand` / `name` aliases. Colors are the usual public brand hex.
 * Leon expands `KNOWN_STORE_MODELS` when a 3D store exists.
 */
export const BRANDS: readonly Brand[] = [
  { brandKey: "walmart", name: "Walmart", color: "#0071ce", wikidata: "Q483551", wikidataIds: ["Q483551"], category: "grocery", aliases: ["walmart", "wal-mart", "walmart supercenter", "walmart neighborhood market"], nsi: "shop/supermarket|Walmart", logoFile: "Walmart_logo.svg" },
  { brandKey: "target", name: "Target", color: "#cc0000", wikidata: "Q1046951", wikidataIds: ["Q1046951"], category: "retail", aliases: ["target"], nsi: "shop/department_store|Target", logoFile: "Target_Corporation_logo_(2024).svg" },
  { brandKey: "costco", name: "Costco", color: "#e31837", wikidata: "Q715583", wikidataIds: ["Q715583"], category: "grocery", aliases: ["costco", "costco wholesale"], nsi: "shop/supermarket|Costco", logoFile: "Costco_Wholesale_logo_2010-10-26.svg" },
  { brandKey: "kroger", name: "Kroger", color: "#0066b2", wikidata: "Q153417", wikidataIds: ["Q153417"], category: "grocery", aliases: ["kroger"], nsi: "shop/supermarket|Kroger" },
  { brandKey: "publix", name: "Publix", color: "#3d8b37", wikidata: "Q672170", wikidataIds: ["Q672170"], category: "grocery", aliases: ["publix", "publix super market", "publix supermarket"], nsi: "shop/supermarket|Publix" },
  { brandKey: "whole-foods", name: "Whole Foods", color: "#00674b", wikidata: "Q180944", wikidataIds: ["Q180944"], category: "grocery", aliases: ["whole foods", "whole foods market"], nsi: "shop/supermarket|Whole Foods Market" },
  { brandKey: "aldi", name: "Aldi", color: "#00a0e1", wikidata: "Q125054", wikidataIds: ["Q125054", "Q41171391", "Q41171672"], category: "grocery", aliases: ["aldi", "aldi sud", "aldi süd", "aldi nord"], nsi: "shop/supermarket|Aldi" },
  { brandKey: "trader-joes", name: "Trader Joe's", color: "#e31c23", wikidata: "Q688825", wikidataIds: ["Q688825"], category: "grocery", aliases: ["trader joe's", "trader joes"], nsi: "shop/supermarket|Trader Joe's" },
  { brandKey: "safeway", name: "Safeway", color: "#e31837", wikidata: "Q1592526", wikidataIds: ["Q1592526"], category: "grocery", aliases: ["safeway"], nsi: "shop/supermarket|Safeway" },
  { brandKey: "albertsons", name: "Albertsons", color: "#003da5", wikidata: "Q2831861", wikidataIds: ["Q2831861"], category: "grocery", aliases: ["albertsons", "albertson's"], nsi: "shop/supermarket|Albertsons" },
  { brandKey: "cvs", name: "CVS", color: "#cc0000", wikidata: "Q2078880", wikidataIds: ["Q2078880", "Q2078888"], category: "pharmacy", aliases: ["cvs", "cvs pharmacy", "cvs/pharmacy"], nsi: "amenity/pharmacy|CVS Pharmacy" },
  { brandKey: "walgreens", name: "Walgreens", color: "#e31837", wikidata: "Q1591889", wikidataIds: ["Q1591889"], category: "pharmacy", aliases: ["walgreens", "walgreen"], nsi: "amenity/pharmacy|Walgreens" },
  { brandKey: "rite-aid", name: "Rite Aid", color: "#003da5", wikidata: "Q3433273", wikidataIds: ["Q3433273"], category: "pharmacy", aliases: ["rite aid", "riteaid"], nsi: "amenity/pharmacy|Rite Aid" },
  { brandKey: "shell", name: "Shell", color: "#ffd100", wikidata: "Q154950", wikidataIds: ["Q154950"], category: "fuel", aliases: ["shell"], nsi: "amenity/fuel|Shell", logoFile: "Shell_logo.svg" },
  { brandKey: "exxon", name: "Exxon", color: "#ed1c24", wikidata: "Q4781940", wikidataIds: ["Q4781940", "Q156238"], category: "fuel", aliases: ["exxon", "exxonmobil", "exxon mobil"], nsi: "amenity/fuel|Exxon" },
  { brandKey: "chevron", name: "Chevron", color: "#ed1c24", wikidata: "Q319642", wikidataIds: ["Q319642"], category: "fuel", aliases: ["chevron"], nsi: "amenity/fuel|Chevron" },
  { brandKey: "bp", name: "BP", color: "#00a651", wikidata: "Q152057", wikidataIds: ["Q152057"], category: "fuel", aliases: ["bp", "british petroleum"], nsi: "amenity/fuel|BP" },
  { brandKey: "circle-k", name: "Circle K", color: "#e31837", wikidata: "Q3268010", wikidataIds: ["Q3268010"], category: "fuel", aliases: ["circle k", "circlek"], nsi: "amenity/fuel|Circle K" },
  { brandKey: "wawa", name: "Wawa", color: "#007a33", wikidata: "Q7978487", wikidataIds: ["Q7978487"], category: "fuel", aliases: ["wawa"], nsi: "amenity/fuel|Wawa" },
  { brandKey: "7-eleven", name: "7-Eleven", color: "#00703c", wikidata: "Q259340", wikidataIds: ["Q259340"], category: "retail", aliases: ["7-eleven", "7 eleven", "7-11", "seven eleven"], nsi: "shop/convenience|7-Eleven" },
  { brandKey: "mcdonalds", name: "McDonald's", color: "#ffc72c", wikidata: "Q38076", wikidataIds: ["Q38076"], category: "fast_food", aliases: ["mcdonald's", "mcdonalds", "mc donald's", "mc donalds"], nsi: "amenity/fast_food|McDonald's", logoFile: "McDonald's_Golden_Arches.svg" },
  { brandKey: "burger-king", name: "Burger King", color: "#d62300", wikidata: "Q177054", wikidataIds: ["Q177054"], category: "fast_food", aliases: ["burger king"], nsi: "amenity/fast_food|Burger King" },
  { brandKey: "wendys", name: "Wendy's", color: "#e41e26", wikidata: "Q550258", wikidataIds: ["Q550258"], category: "fast_food", aliases: ["wendy's", "wendys"], nsi: "amenity/fast_food|Wendy's" },
  { brandKey: "taco-bell", name: "Taco Bell", color: "#702082", wikidata: "Q752941", wikidataIds: ["Q752941"], category: "fast_food", aliases: ["taco bell"], nsi: "amenity/fast_food|Taco Bell" },
  { brandKey: "chick-fil-a", name: "Chick-fil-A", color: "#e51636", wikidata: "Q491516", wikidataIds: ["Q491516"], category: "fast_food", aliases: ["chick-fil-a", "chick fil a", "chickfila", "chick-fil-a"], nsi: "amenity/fast_food|Chick-fil-A" },
  { brandKey: "subway", name: "Subway", color: "#008c15", wikidata: "Q244457", wikidataIds: ["Q244457"], category: "fast_food", aliases: ["subway"], nsi: "amenity/fast_food|Subway" },
  { brandKey: "chipotle", name: "Chipotle", color: "#a81612", wikidata: "Q465021", wikidataIds: ["Q465021"], category: "fast_food", aliases: ["chipotle", "chipotle mexican grill"], nsi: "amenity/fast_food|Chipotle" },
  { brandKey: "starbucks", name: "Starbucks", color: "#00704a", wikidata: "Q37158", wikidataIds: ["Q37158"], category: "coffee", aliases: ["starbucks", "starbucks coffee"], nsi: "amenity/cafe|Starbucks", logoFile: "Starbucks_Coffee_Logo.svg" },
  { brandKey: "dunkin", name: "Dunkin'", color: "#e11383", wikidata: "Q847743", wikidataIds: ["Q847743"], category: "coffee", aliases: ["dunkin", "dunkin'", "dunkin donuts", "dunkin' donuts"], nsi: "amenity/fast_food|Dunkin'" },
  { brandKey: "home-depot", name: "The Home Depot", color: "#f96302", wikidata: "Q864407", wikidataIds: ["Q864407"], category: "retail", aliases: ["home depot", "the home depot"], nsi: "shop/doityourself|The Home Depot", logoFile: "TheHomeDepot.svg" },
  { brandKey: "lowes", name: "Lowe's", color: "#004990", wikidata: "Q839933", wikidataIds: ["Q839933"], category: "retail", aliases: ["lowe's", "lowes"], nsi: "shop/doityourself|Lowe's" },
  { brandKey: "best-buy", name: "Best Buy", color: "#0046be", wikidata: "Q533415", wikidataIds: ["Q533415"], category: "retail", aliases: ["best buy", "bestbuy"], nsi: "shop/electronics|Best Buy" },
];

/** Brand keys Leon has (or will ship) a dedicated 3D store for. Everything else is generic. */
export const KNOWN_STORE_MODELS: readonly string[] = [
  "walmart",
  "target",
  "publix",
  "starbucks",
  "mcdonalds",
  "shell",
  "wawa",
  "home-depot",
  "cvs",
  "walgreens",
];

const CATEGORY_COLOR: Record<StoreCategory, string> = {
  grocery: "#3d8b37",
  pharmacy: "#cc0000",
  fuel: "#ffd100",
  fast_food: "#e51636",
  coffee: "#00704a",
  retail: "#0046be",
  other: "#8a8f98",
};

const byWikidata = new Map<string, Brand>();
const byAlias = new Map<string, Brand>();
const byKey = new Map<string, Brand>();

for (const b of BRANDS) {
  byKey.set(b.brandKey, b);
  for (const id of b.wikidataIds) byWikidata.set(id.toUpperCase(), b);
  for (const a of b.aliases) byAlias.set(normName(a), b);
  byAlias.set(normName(b.name), b);
  byAlias.set(b.brandKey, b);
}

export function brandByKey(key: string): Brand | undefined {
  return byKey.get(key);
}

export function brandByWikidata(id: string | undefined): Brand | undefined {
  if (!id) return undefined;
  return byWikidata.get(id.trim().toUpperCase());
}

export function brandByName(raw: string | undefined): Brand | undefined {
  if (!raw) return undefined;
  return byAlias.get(normName(raw));
}

export function categoryColor(category: StoreCategory): string {
  return CATEGORY_COLOR[category];
}

export function commonsFileUrl(file: string, width = 256): string {
  const name = file.replace(/^File:/i, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;
}

export function brandLogoUrl(brand: Brand): string | undefined {
  return brand.logoFile ? commonsFileUrl(brand.logoFile) : undefined;
}

/** Fold a display name for alias lookup (NSI / OSM `brand`). */
export function normName(raw: string): string {
  return raw
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugify(raw: string): string {
  return raw
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "store";
}

export function wikidataRegex(): string {
  const ids = [...new Set(BRANDS.flatMap((b) => [...b.wikidataIds]))];
  return `^(${ids.join("|")})$`;
}

export function brandNameRegex(): string {
  const names = [...new Set(BRANDS.flatMap((b) => [b.name, ...b.aliases]))]
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  return `^(${names.join("|")})$`;
}
