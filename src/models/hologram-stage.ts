import { prefersReducedMotion, type HologramDispose, type HologramOpts } from "../look/hologram";
import { fallbackHologramMarkup } from "./fallback";
import { resolveHologramModelKey } from "./resolve";
import { frameObject, hologramMaterials, loadThree, disposeObject } from "./stage-utils";
import { buildStoreGroup } from "./store-meshes";
import { parseHexColor, webglAvailable } from "./webgl";

/**
 * Mount a floating hologram into `el`. Falls back to SVG when WebGL is gone.
 * Always dispose the returned handle — renderer, geos, and the shared pair
 * of materials are created per slot.
 */
export function mountHologramModel(el: HTMLElement, opts: HologramOpts): HologramDispose {
  const modelKey = resolveHologramModelKey(opts.modelKey);
  const color = opts.color || "#f0a04b";
  let disposed = false;
  let inner: HologramDispose | null = null;

  paintFallback(el, modelKey, color);

  if (!webglAvailable()) {
    return () => {
      disposed = true;
      el.replaceChildren();
    };
  }

  void boot(el, modelKey, color)
    .then((stop) => {
      if (disposed) stop();
      else inner = stop;
    })
    .catch(() => {
      if (!disposed) paintFallback(el, modelKey, color);
    });

  return () => {
    disposed = true;
    inner?.();
    inner = null;
    el.replaceChildren();
  };
}

function paintFallback(el: HTMLElement, modelKey: string, color: string) {
  el.innerHTML = fallbackHologramMarkup(modelKey, color);
}

async function boot(el: HTMLElement, modelKey: string, color: string): Promise<HologramDispose> {
  const THREE = await loadThree();
  if (!el.isConnected && typeof el.isConnected === "boolean") {
    return () => undefined;
  }

  const wrap = document.createElement("div");
  wrap.className = "look-holo-3d";
  wrap.dataset.modelKey = modelKey;
  wrap.style.setProperty("--holo-color", color);
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", `Store model ${modelKey}`);

  const scan = document.createElement("i");
  scan.className = "look-holo-scan";
  scan.setAttribute("aria-hidden", "true");

  const glow = document.createElement("i");
  glow.className = "look-holo-glow";
  glow.setAttribute("aria-hidden", "true");

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  const { fill, edge } = hologramMaterials(THREE, parseHexColor(color));
  const group = buildStoreGroup(THREE, modelKey, fill, edge);
  scene.add(group);
  frameObject(THREE, camera, group);

  wrap.replaceChildren(renderer.domElement, scan, glow);
  el.replaceChildren(wrap);

  const still = prefersReducedMotion();
  let raf = 0;
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  const sizeToHost = () => {
    const w = Math.max(1, wrap.clientWidth || el.clientWidth || 88);
    const h = Math.max(1, wrap.clientHeight || el.clientHeight || 88);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  sizeToHost();

  const tick = (now: number) => {
    if (!still) {
      const t = (now - t0) / 1000;
      group.rotation.y = t * 0.42;
      group.position.y = Math.sin(t * 1.35) * 0.055;
    }
    renderer.render(scene, camera);
    if (!still) raf = requestAnimationFrame(tick);
  };

  if (still) renderer.render(scene, camera);
  else raf = requestAnimationFrame(tick);

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(sizeToHost);
    observer.observe(wrap);
  }

  return () => {
    cancelAnimationFrame(raf);
    observer?.disconnect();
    scene.remove(group);
    disposeObject(group);
    renderer.dispose();
    renderer.domElement.remove();
    wrap.replaceChildren();
  };
}
