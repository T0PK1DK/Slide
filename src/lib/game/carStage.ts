/**
 * Lightweight 3D unlock stage. three.js is lazy-loaded so first paint
 * stays MapLibre-only. Geometry is original low-poly (no licensed brands).
 * Colors come from the current paint / glow. prefers-reduced-motion skips spin.
 */
import { vehicleSvg, type Livery, type VehicleId } from "../vehicles";

export type CarStageLook = {
  vehicle: VehicleId;
  livery: Livery;
  paint: string;
  accent: string;
};

export type CarStageHandle = {
  show(look: CarStageLook): Promise<void>;
  update(look: CarStageLook): void;
  hide(): void;
  dispose(): void;
};

type RideSpec = { w: number; h: number; l: number; cab: number; bed: number };

const SPECS: Record<string, RideSpec> = {
  slipstream: { w: 1.05, h: 0.38, l: 2.15, cab: 0.28, bed: 0 },
  brawler: { w: 1.12, h: 0.46, l: 2.05, cab: 0.3, bed: 0 },
  hatch: { w: 1.0, h: 0.5, l: 1.7, cab: 0.36, bed: 0 },
  ridge: { w: 1.18, h: 0.62, l: 2.1, cab: 0.4, bed: 0 },
  hauler: { w: 1.16, h: 0.56, l: 2.25, cab: 0.34, bed: 0.72 },
  classic: { w: 1.0, h: 0.36, l: 1.85, cab: 0.26, bed: 0 },
  nimbus: { w: 1.08, h: 0.42, l: 2.2, cab: 0.3, bed: 0 },
  glider: { w: 1.14, h: 0.44, l: 2.35, cab: 0.32, bed: 0 },
};

export function rideSpec(id: string): RideSpec {
  return SPECS[id] ?? SPECS.slipstream;
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type ThreeMod = typeof import("three");

function hex(value: string, fallback: number): number {
  const n = Number.parseInt(value.replace("#", ""), 16);
  return Number.isFinite(n) ? n : fallback;
}

function buildCar(THREE: ThreeMod, look: CarStageLook) {
  const spec = rideSpec(look.vehicle);
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: hex(look.paint, 0xe8eef2),
    metalness: 0.32,
    roughness: 0.42,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: hex(look.accent, 0xf0a04b),
    metalness: 0.2,
    roughness: 0.46,
    emissive: hex(look.accent, 0xf0a04b),
    emissiveIntensity: 0.16,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1218,
    metalness: 0.7,
    roughness: 0.12,
    transparent: true,
    opacity: 0.72,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.92 });

  const bodyLen = spec.bed ? spec.l - spec.bed : spec.l;
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, bodyLen), bodyMat);
  body.position.y = spec.h / 2 + 0.14;
  if (spec.bed) body.position.z = spec.bed / 2;
  group.add(body);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.78, spec.cab, bodyLen * 0.42), glassMat);
  cab.position.y = spec.h + spec.cab / 2 + 0.1;
  cab.position.z = spec.bed ? spec.bed * 0.35 : -bodyLen * 0.08;
  group.add(cab);

  if (spec.bed) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.92, spec.h * 0.45, spec.bed), bodyMat);
    bed.position.set(0, spec.h * 0.42, -bodyLen / 2);
    group.add(bed);
  }

  if (look.livery === "stripes") {
    for (const x of [-0.12, 0.12]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, spec.h + 0.02, spec.l * 0.92), accentMat);
      stripe.position.set(x, spec.h / 2 + 0.16, 0);
      group.add(stripe);
    }
  } else if (look.livery === "fade") {
    const fade = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.01, spec.h * 0.55, spec.l * 0.42), accentMat);
    fade.position.set(0, spec.h * 0.4, -spec.l * 0.22);
    group.add(fade);
  } else if (look.livery === "halo") {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), accentMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, spec.h + spec.cab + 0.16, cab.position.z);
    group.add(halo);
  } else if (look.livery === "dusk") {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.8, 0.06, bodyLen * 0.5), accentMat);
    roof.position.set(0, spec.h + spec.cab + 0.12, cab.position.z);
    group.add(roof);
  }

  const glow = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.08, 0.04, spec.l * 0.9), accentMat);
  glow.position.y = 0.08;
  group.add(glow);

  const wheel = new THREE.CylinderGeometry(0.18, 0.18, 0.16, 10);
  const axles: Array<[number, number]> = [
    [-spec.w / 2, spec.l * 0.28],
    [spec.w / 2, spec.l * 0.28],
    [-spec.w / 2, -spec.l * 0.3],
    [spec.w / 2, -spec.l * 0.3],
  ];
  for (const [x, z] of axles) {
    const w = new THREE.Mesh(wheel, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.18, z);
    group.add(w);
  }

  group.rotation.y = Math.PI * 0.18;
  return group;
}

function clearGroup(group: { traverse: (fn: (obj: { geometry?: { dispose: () => void }; material?: { dispose: () => void } | Array<{ dispose: () => void }> }) => void) => void }) {
  group.traverse((obj) => {
    obj.geometry?.dispose();
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

export function mountCarStage(host: HTMLElement): CarStageHandle {
  let look: CarStageLook | null = null;
  let renderer: { setPixelRatio: (n: number) => void; setClearColor: (c: number, a: number) => void; setSize: (w: number, h: number, u?: boolean) => void; render: (s: unknown, c: unknown) => void; dispose: () => void; domElement: HTMLCanvasElement } | null = null;
  let scene: { add: (...objs: unknown[]) => void; remove: (obj: unknown) => void } | null = null;
  let camera: { aspect: number; updateProjectionMatrix: () => void; position: { set: (x: number, y: number, z: number) => void }; lookAt: (x: number, y: number, z: number) => void } | null = null;
  let car: { rotation: { y: number }; traverse: (fn: (obj: { geometry?: { dispose: () => void }; material?: { dispose: () => void } | Array<{ dispose: () => void }> }) => void) => void } | null = null;
  let raf = 0;
  let disposed = false;
  let loading: Promise<void> | null = null;

  const still = () => prefersReducedMotion();

  const frame = () => {
    if (!renderer || !scene || !camera || disposed) return;
    if (car && !still()) car.rotation.y += 0.008;
    renderer.render(scene, camera);
    if (!still()) raf = requestAnimationFrame(frame);
  };

  const sizeToHost = () => {
    if (!renderer || !camera) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const paintSvg = (next: CarStageLook) => {
    host.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "car-stage-svg";
    wrap.innerHTML = vehicleSvg({
      model: next.vehicle,
      paint: next.paint,
      accent: next.accent,
      livery: next.livery,
    });
    host.append(wrap);
  };

  const rebuildCar = (THREE: ThreeMod, next: CarStageLook) => {
    if (!scene) return;
    if (car) {
      scene.remove(car);
      clearGroup(car);
    }
    car = buildCar(THREE, next);
    scene.add(car);
  };

  const boot = async (next: CarStageLook) => {
    const THREE = await import("three");
    if (disposed) return;
    host.replaceChildren();
    const nextScene = new THREE.Scene();
    const nextCam = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    nextCam.position.set(2.4, 1.6, 3.4);
    nextCam.lookAt(0, 0.45, 0);
    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(2.2, 3.4, 1.6);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-2, 1.2, -1.4);
    nextScene.add(amb, key, fill);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x161a1e, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    nextScene.add(ground);
    const nextRenderer = new THREE.WebGLRenderer({ antialias: !still(), alpha: true });
    nextRenderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 2));
    nextRenderer.setClearColor(0x000000, 0);
    host.append(nextRenderer.domElement);
    scene = nextScene;
    camera = nextCam;
    renderer = nextRenderer;
    rebuildCar(THREE, next);
    sizeToHost();
    cancelAnimationFrame(raf);
    if (still()) nextRenderer.render(nextScene, nextCam);
    else raf = requestAnimationFrame(frame);
  };

  return {
    async show(next) {
      look = next;
      disposed = false;
      if (renderer && scene) {
        const THREE = await import("three");
        rebuildCar(THREE, next);
        sizeToHost();
        cancelAnimationFrame(raf);
        if (still() && renderer && scene && camera) renderer.render(scene, camera);
        else raf = requestAnimationFrame(frame);
        return;
      }
      loading = (loading ?? boot(next).catch(() => paintSvg(next))).finally(() => {
        loading = null;
      });
      await loading;
    },
    update(next) {
      look = next;
      if (renderer && scene) void this.show(next);
      else if (look) paintSvg(next);
    },
    hide() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      if (car && scene) {
        scene.remove(car);
        clearGroup(car);
      }
      car = null;
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = null;
      scene = null;
      camera = null;
      look = null;
      host.replaceChildren();
    },
  };
}
