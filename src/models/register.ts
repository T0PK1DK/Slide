import { registerHologramRenderer } from "../look/hologram";
import { mountGhostCarModel } from "./ghost-stage";
import { registerGhostCarRenderer } from "./ghost-renderer";
import { mountHologramModel } from "./hologram-stage";
import { GENERIC_MODEL_KEYS, GHOST_CAR_ALIASES, GHOST_CAR_KEYS, HOLOGRAM_BRAND_KEYS } from "./keys";

let registered = false;

/**
 * Hook-in for Grim's `registerHologramRenderer` and the ghost-car register.
 * Safe to call twice. Does not load three.js until a slot mounts.
 */
export function registerSlideModels(): void {
  if (registered) return;
  registered = true;

  const hologram = (el: HTMLElement, opts: { modelKey: string; color: string }) => mountHologramModel(el, opts);
  for (const key of HOLOGRAM_BRAND_KEYS) registerHologramRenderer(key, hologram);
  for (const key of GENERIC_MODEL_KEYS) registerHologramRenderer(key, hologram);
  registerHologramRenderer("*", hologram);

  const ghost = (el: HTMLElement, opts: { carModelKey: string; color: string; headingDeg?: number; speedMps?: number }) =>
    mountGhostCarModel(el, opts);
  const carKeys = new Set<string>([...GHOST_CAR_KEYS, ...Object.keys(GHOST_CAR_ALIASES)]);
  for (const key of carKeys) registerGhostCarRenderer(key, ghost);
  registerGhostCarRenderer("*", ghost);
}

export function resetSlideModelsForTests(): void {
  registered = false;
}
