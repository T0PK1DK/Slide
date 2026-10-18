import { BRANDS } from "../lib/stores/brands";

/** Nard's US chains — derived from `BRANDS` so this and `KNOWN_STORE_MODELS` can't drift. */
export const HOLOGRAM_BRAND_KEYS = BRANDS.map((b) => b.brandKey);

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

export const BRAND_CATEGORY: Record<string, string> = Object.fromEntries(
  BRANDS.map((b) => [b.brandKey, b.category]),
);
