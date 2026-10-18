import { prefersReducedMotion } from "../look/hologram";
import { buildGhostCarGroup } from "./car-meshes";
import { fallbackGhostCarMarkup } from "./fallback";
import type { GhostCarDispose, GhostCarOpts } from "./ghost-renderer";
import { resolveGhostCarKey } from "./resolve";
import { disposeObject, frameObject, ghostMaterials, loadThree } from "./stage-utils";
import { parseHexColor, webglAvailable } from "./webgl";

export function mountGhostCarModel(el: HTMLElement, opts: GhostCarOpts): GhostCarDispose {
  const kind = resolveGhostCarKey(opts.carModelKey);
  const color = opts.color || "#f0a04b";
  let disposed = false;
  let inner: GhostCarDispose | null = null;

  paintFallback(el, kind, color);
  el.dataset.heading = String(Number.isFinite(opts.headingDeg) ? opts.headingDeg : 0);
  el.dataset.speed = String(Number.isFinite(opts.speedMps) ? opts.speedMps : 0);

  if (!webglAvailable()) {
    return () => {
      disposed = true;
    };
  }

  void boot(el, kind, color, opts.speedMps ?? 0)
    .then((stop) => {
      if (disposed) stop();
      else inner = stop;
    })
    .catch(() => {
      if (!disposed) paintFallback(el, kind, color);
    });

  return () => {
    disposed = true;
    inner?.();
    inner = null;
  };
}

function paintFallback(el: HTMLElement, kind: string, color: string) {
  el.innerHTML = fallbackGhostCarMarkup(kind, color);
}

async function boot(el: HTMLElement, kind: string, color: string, speedMps: number): Promise<GhostCarDispose> {
  const THREE = await loadThree();
  const wrap = document.createElement("div");
  wrap.className = "look-ghost-3d";
  wrap.dataset.carKey = kind;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 28 / 48, 0.1, 12);
  const { fill, edge } = ghostMaterials(THREE, parseHexColor(color));
  fill.opacity = 0.28 + Math.min(0.14, speedMps * 0.008);
  const group = buildGhostCarGroup(THREE, kind, fill, edge);
  scene.add(group);
  frameObject(THREE, camera, group, 1.15);
  camera.position.y += 0.35;

  wrap.append(renderer.domElement);
  el.replaceChildren(wrap);

  const still = prefersReducedMotion();
  let raf = 0;
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const w = Math.max(1, el.clientWidth || 28);
  const h = Math.max(1, el.clientHeight || 48);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  const tick = (now: number) => {
    if (!still) {
      const t = (now - t0) / 1000;
      group.position.y = Math.sin(t * 1.6) * 0.02;
    }
    renderer.render(scene, camera);
    if (!still) raf = requestAnimationFrame(tick);
  };

  if (still) renderer.render(scene, camera);
  else raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    scene.remove(group);
    disposeObject(group);
    renderer.dispose();
    renderer.domElement.remove();
    wrap.replaceChildren();
  };
}
