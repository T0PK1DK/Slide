/**
 * Hologram slot for Leon. Default is a soft glowing, slowly rotating outline.
 * Leon registers a renderer per `modelKey` (or `"*"`) and this host calls it
 * with the stage element. Always dispose what you create.
 */

export type HologramOpts = { modelKey: string; color: string };
export type HologramDispose = () => void;
export type HologramRenderer = (el: HTMLElement, opts: HologramOpts) => HologramDispose | void;

const renderers = new Map<string, HologramRenderer>();

export function registerHologramRenderer(
  modelKey: string | "*",
  renderer: HologramRenderer,
): () => void {
  const key = modelKey;
  renderers.set(key, renderer);
  return () => {
    if (renderers.get(key) === renderer) renderers.delete(key);
  };
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Low-poly store outline. Color comes from the brand. */
export function defaultHologramMarkup(opts: HologramOpts): string {
  const color = opts.color || "#f0a04b";
  const spin = prefersReducedMotion() ? "" : " look-holo-spin";
  const key = escapeAttr(opts.modelKey);
  return `<div class="look-holo${spin}" data-model-key="${key}" style="--holo-color:${escapeAttr(color)}" role="img" aria-label="3D model slot for ${key}">
  <svg class="look-holo-outline" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 28 L32 12 L54 28 V52 H10 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M22 52 V36 H42 V52" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M10 28 H54" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".7"/>
    <circle cx="32" cy="24" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3"/>
  </svg>
  <i class="look-holo-glow" aria-hidden="true"></i>
</div>`;
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function defaultRenderer(el: HTMLElement, opts: HologramOpts): HologramDispose {
  el.innerHTML = defaultHologramMarkup(opts);
  return () => {
    el.replaceChildren();
  };
}

export function resolveHologramRenderer(modelKey: string): HologramRenderer {
  return renderers.get(modelKey) ?? renderers.get("*") ?? defaultRenderer;
}

/**
 * Paint a hologram into `el`. Returns a dispose function. Re-calling on the
 * same node is safe: the previous renderer is disposed first by the caller.
 */
export function mountHologram(el: HTMLElement, opts: HologramOpts): HologramDispose {
  const renderer = resolveHologramRenderer(opts.modelKey);
  el.replaceChildren();
  const inner = renderer(el, opts);
  return () => {
    inner?.();
    el.replaceChildren();
  };
}

export function clearHologramRenderers(): void {
  renderers.clear();
}
