import { storeRecipe } from "./store-meshes";
import { ghostCarKind } from "./car-meshes";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** SVG stand-in when WebGL is missing. Shape family only — still no logos. */
export function fallbackHologramMarkup(modelKey: string, color: string): string {
  const recipe = storeRecipe(modelKey);
  const key = recipe.key;
  const tint = esc(color || "#f0a04b");
  const paths = FAMILY_PATH[recipe.family];
  return `<div class="look-holo look-holo-fallback" data-model-key="${esc(key)}" data-holo-fallback="1" style="--holo-color:${tint}" role="img" aria-label="Store model ${esc(key)}">
  <svg class="look-holo-outline" viewBox="0 0 64 64" aria-hidden="true">${paths}</svg>
  <i class="look-holo-glow" aria-hidden="true"></i>
  <i class="look-holo-scan" aria-hidden="true"></i>
</div>`;
}

const FAMILY_PATH: Record<string, string> = {
  grocery:
    '<path d="M10 30 L32 14 L54 30 V52 H10 Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M22 52 V36 H42 V52" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  pharmacy:
    '<rect x="14" y="22" width="36" height="30" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M32 28 V46 M23 37 H41" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  fuel:
    '<path d="M12 28 H52 V34 H12 Z" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="20" y="34" width="8" height="16" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="36" y="34" width="8" height="16" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  food:
    '<path d="M14 34 H50 V52 H14 Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M20 34 Q32 12 44 34" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  coffee:
    '<rect x="16" y="26" width="28" height="24" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M44 32 H50 A6 6 0 0 1 50 44 H44" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  retail:
    '<rect x="12" y="20" width="40" height="32" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 28 H52" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  other:
    '<path d="M12 30 L32 14 L52 30 V52 H12 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
};

export function fallbackGhostCarMarkup(carModelKey: string, color: string): string {
  const kind = ghostCarKind(carModelKey);
  const tint = esc(color || "#f0a04b");
  return `<div class="look-ghost-3d look-ghost-fallback" data-car-key="${esc(kind)}" data-ghost-fallback="1" style="--ghost-color:${tint}">
  <svg viewBox="0 0 28 48" aria-hidden="true">${GHOST_PATH[kind]}</svg>
</div>`;
}

const GHOST_PATH: Record<string, string> = {
  sedan:
    '<rect x="6" y="10" width="16" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8" y="16" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  suv:
    '<rect x="5" y="8" width="18" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="7" y="14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  pickup:
    '<rect x="6" y="8" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="6" y="24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  sports:
    '<path d="M8 8 L20 8 L22 22 L20 40 L8 40 L6 22 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  default:
    '<path d="M8 10 L20 10 L22 38 L6 38 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
};
