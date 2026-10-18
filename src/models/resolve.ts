import {
  FALLBACK_MODEL_KEY,
  GENERIC_MODEL_KEYS,
  GHOST_CAR_ALIASES,
  HOLOGRAM_BRAND_KEYS,
  type GhostCarKey,
  type HologramModelKey,
} from "./keys";

const BRANDS = new Set<string>(HOLOGRAM_BRAND_KEYS);
const GENERICS = new Set<string>(GENERIC_MODEL_KEYS);

/**
 * Brand model, then `generic-<category>`, then `"*"`.
 * Unknown slugs (and Nard's `generic-*` when we have that recipe) resolve here
 * so the `"*"` renderer still paints a known silhouette.
 */
export function resolveHologramModelKey(modelKey: string | undefined | null): HologramModelKey {
  const key = (modelKey ?? "").trim().toLowerCase();
  if (BRANDS.has(key)) return key as HologramModelKey;
  if (GENERICS.has(key)) return key as HologramModelKey;
  if (key.startsWith("generic-")) {
    const generic = `generic-${key.slice("generic-".length)}`;
    if (GENERICS.has(generic)) return generic as HologramModelKey;
  }
  return FALLBACK_MODEL_KEY;
}

export function resolveGhostCarKey(carModelKey: string | undefined | null): GhostCarKey {
  const key = (carModelKey ?? "").trim().toLowerCase();
  return GHOST_CAR_ALIASES[key] ?? "default";
}

export function hasBrandModel(modelKey: string): boolean {
  return BRANDS.has(modelKey.trim().toLowerCase());
}
