/**
 * Ghost-car renderer hook, matching Grim's hologram register shape.
 * The map layer calls `mountGhostCar` on `.look-ghost-car`. Default is a
 * no-op so Grim's SVG silhouette stays until models register.
 */

export type GhostCarOpts = {
  carModelKey: string;
  color: string;
  headingDeg?: number;
  speedMps?: number;
};

export type GhostCarDispose = () => void;
export type GhostCarRenderer = (el: HTMLElement, opts: GhostCarOpts) => GhostCarDispose | void;

const renderers = new Map<string, GhostCarRenderer>();

export function registerGhostCarRenderer(
  carModelKey: string | "*",
  renderer: GhostCarRenderer,
): () => void {
  const key = carModelKey;
  renderers.set(key, renderer);
  return () => {
    if (renderers.get(key) === renderer) renderers.delete(key);
  };
}

function defaultGhostCarRenderer(): GhostCarDispose {
  return () => undefined;
}

export function resolveGhostCarRenderer(carModelKey: string): GhostCarRenderer {
  return renderers.get(carModelKey) ?? renderers.get("*") ?? defaultGhostCarRenderer;
}

export function mountGhostCar(el: HTMLElement, opts: GhostCarOpts): GhostCarDispose {
  const renderer = resolveGhostCarRenderer(opts.carModelKey);
  const inner = renderer(el, opts);
  return () => {
    inner?.();
  };
}

export function clearGhostCarRenderers(): void {
  renderers.clear();
}
