/** Nard's ~32 US chains from docs/DATA_SHAPES.md (`BRANDS` on #55). */
export const HOLOGRAM_BRAND_KEYS = [
  "walmart",
  "target",
  "costco",
  "kroger",
  "publix",
  "whole-foods",
  "aldi",
  "trader-joes",
  "safeway",
  "albertsons",
  "cvs",
  "walgreens",
  "rite-aid",
  "shell",
  "exxon",
  "chevron",
  "bp",
  "circle-k",
  "wawa",
  "7-eleven",
  "mcdonalds",
  "burger-king",
  "wendys",
  "taco-bell",
  "chick-fil-a",
  "subway",
  "chipotle",
  "starbucks",
  "dunkin",
  "home-depot",
  "lowes",
  "best-buy",
] as const;

export type HologramBrandKey = (typeof HOLOGRAM_BRAND_KEYS)[number];

export const GENERIC_MODEL_KEYS = [
  "generic-grocery",
  "generic-pharmacy",
  "generic-fuel",
  "generic-fast_food",
  "generic-coffee",
  "generic-retail",
  "generic-other",
] as const;

export type GenericModelKey = (typeof GENERIC_MODEL_KEYS)[number];

export const FALLBACK_MODEL_KEY = "*";

export const HOLOGRAM_MODEL_KEYS = [...HOLOGRAM_BRAND_KEYS, ...GENERIC_MODEL_KEYS, FALLBACK_MODEL_KEY] as const;

export type HologramModelKey = (typeof HOLOGRAM_MODEL_KEYS)[number];

export const GHOST_CAR_KEYS = ["sedan", "suv", "pickup", "sports", "default"] as const;

export type GhostCarKey = (typeof GHOST_CAR_KEYS)[number];

/** Garage ids (Nard `carModelKey`) plus the five hull names. */
export const GHOST_CAR_ALIASES: Record<string, GhostCarKey> = {
  sedan: "sedan",
  hatch: "sedan",
  classic: "sedan",
  glider: "sedan",
  nimbus: "sedan",
  suv: "suv",
  ridge: "suv",
  pickup: "pickup",
  hauler: "pickup",
  sports: "sports",
  slipstream: "sports",
  brawler: "sports",
  default: "default",
};

export const BRAND_CATEGORY: Record<HologramBrandKey, string> = {
  walmart: "grocery",
  target: "retail",
  costco: "grocery",
  kroger: "grocery",
  publix: "grocery",
  "whole-foods": "grocery",
  aldi: "grocery",
  "trader-joes": "grocery",
  safeway: "grocery",
  albertsons: "grocery",
  cvs: "pharmacy",
  walgreens: "pharmacy",
  "rite-aid": "pharmacy",
  shell: "fuel",
  exxon: "fuel",
  chevron: "fuel",
  bp: "fuel",
  "circle-k": "fuel",
  wawa: "fuel",
  "7-eleven": "retail",
  mcdonalds: "fast_food",
  "burger-king": "fast_food",
  wendys: "fast_food",
  "taco-bell": "fast_food",
  "chick-fil-a": "fast_food",
  subway: "fast_food",
  chipotle: "fast_food",
  starbucks: "coffee",
  dunkin: "coffee",
  "home-depot": "retail",
  lowes: "retail",
  "best-buy": "retail",
};
