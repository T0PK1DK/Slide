export { buildGhostCarGroup, ghostCarKind, ghostCarSignature } from "./car-meshes";
export { fallbackGhostCarMarkup, fallbackHologramMarkup } from "./fallback";
export {
  clearGhostCarRenderers,
  mountGhostCar,
  registerGhostCarRenderer,
  resolveGhostCarRenderer,
  type GhostCarDispose,
  type GhostCarOpts,
  type GhostCarRenderer,
} from "./ghost-renderer";
export { mountGhostCarModel } from "./ghost-stage";
export { mountHologramModel } from "./hologram-stage";
export {
  BRAND_CATEGORY,
  FALLBACK_MODEL_KEY,
  GENERIC_MODEL_KEYS,
  GHOST_CAR_ALIASES,
  GHOST_CAR_KEYS,
  HOLOGRAM_BRAND_KEYS,
  HOLOGRAM_MODEL_KEYS,
  type GhostCarKey,
  type HologramBrandKey,
  type HologramModelKey,
} from "./keys";
export { registerSlideModels, resetSlideModelsForTests } from "./register";
export { hasBrandModel, resolveGhostCarKey, resolveHologramModelKey } from "./resolve";
export {
  buildStoreGroup,
  estimateStoreTriangles,
  storeRecipe,
  storeSignature,
} from "./store-meshes";
export { parseHexColor, webglAvailable } from "./webgl";
