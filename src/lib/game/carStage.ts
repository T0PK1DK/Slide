/**
 * Lightweight 3D unlock stage. three.js is lazy-loaded so first paint
 * stays MapLibre-only. Geometry is original low-poly (no licensed brands).
 * Colors come from the current paint / glow. prefers-reduced-motion skips spin.
 */
import { vehicleSvg } from "../vehicles";
import { buildCar } from "./carMeshes";
import type { CarStageLook } from "./carMeshes";

export type { CarStageLook, RideSpec } from "./carMeshes";
export { rideSpec, rideSilhouette, buildCar } from "./carMeshes";

export type CarStageHandle = {
  show(look: CarStageLook): Promise<void>;
  update(look: CarStageLook): void;
  hide(): void;
  dispose(): void;
};

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type ThreeMod = typeof import("three");

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
  let camera: { fov: number; aspect: number; updateProjectionMatrix: () => void; position: { set: (x: number, y: number, z: number) => void }; lookAt: (x: number, y: number, z: number) => void } | null = null;
  let car: { rotation: { y: number }; updateMatrixWorld?: (f: boolean) => void; traverse: (fn: (obj: { geometry?: { dispose: () => void }; material?: { dispose: () => void } | Array<{ dispose: () => void }> }) => void) => void } | null = null;
  let raf = 0;
  let disposed = false;
  let loading: Promise<void> | null = null;

  const still = () => prefersReducedMotion();
  const hold = () =>
    still() || (typeof document !== "undefined" && document.documentElement.dataset.stageHold === "1");

  let shadow: { scale: { set: (x: number, y: number, z: number) => void } } | null = null;
  let coreShadow: { scale: { set: (x: number, y: number, z: number) => void } } | null = null;
  let threeRef: ThreeMod | null = null;

  const frame = () => {
    if (!renderer || !scene || !camera || disposed) return;
    if (car && !hold()) car.rotation.y += 0.008;
    renderer.render(scene, camera);
    if (!hold()) raf = requestAnimationFrame(frame);
  };

  const frameCar = (THREE: ThreeMod, obj: { updateMatrixWorld?: (f: boolean) => void }) => {
    if (!camera) return;
    obj.updateMatrixWorld?.(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fov = 34;
    camera.fov = fov;
    const aspect = Math.max(0.55, camera.aspect || 1);
    const dir = new THREE.Vector3(1.42, 0.2, 0.82).normalize();
    const forward = dir.clone().negate();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, forward).normalize();
    const sx = Math.abs(right.x) * size.x + Math.abs(right.y) * size.y + Math.abs(right.z) * size.z;
    const sy = Math.abs(camUp.x) * size.x + Math.abs(camUp.y) * size.y + Math.abs(camUp.z) * size.z;
    const vHalf = Math.tan(((fov * Math.PI) / 180) / 2);
    const fill = 0.72;
    const tight = 0.84;
    const dist = Math.max((sy * tight * 0.5) / (vHalf * fill), (sx * tight * 0.5) / (vHalf * aspect * fill), 1.2);
    camera.position.set(center.x + dir.x * dist, Math.max(0.28, center.y * 0.35 + dir.y * dist), center.z + dir.z * dist);
    camera.lookAt(center.x - size.x * 0.04, Math.max(0.12, center.y * 0.55), center.z);
    camera.updateProjectionMatrix();
    shadow?.scale.set(Math.max(0.95, size.x * 0.9), Math.max(1.25, size.z * 0.88), 1);
    coreShadow?.scale.set(Math.max(0.55, size.x * 0.5), Math.max(0.75, size.z * 0.52), 1);
  };

  const sizeToHost = () => {
    if (!renderer || !camera) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (threeRef && car) frameCar(threeRef, car);
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
    const mesh = buildCar(THREE, next);
    car = mesh;
    scene.add(mesh);
    frameCar(THREE, mesh);
  };

  const boot = async (next: CarStageLook) => {
    const THREE = await import("three");
    if (disposed) return;
    threeRef = THREE;
    host.replaceChildren();
    const nextScene = new THREE.Scene();
    const nextCam = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    nextCam.position.set(2.1, 0.78, 2.4);
    nextCam.lookAt(0, 0.22, 0);

    const hemi = new THREE.HemisphereLight(0xf4f1ea, 0x1a1e22, 0.48);
    const key = new THREE.DirectionalLight(0xfff4e6, 0.82);
    key.position.set(2.6, 4.1, 2.4);
    const fill = new THREE.DirectionalLight(0xd7e4ff, 0.28);
    fill.position.set(-3.2, 1.8, 1.2);
    const rim = new THREE.DirectionalLight(0xffffff, 0.42);
    rim.position.set(0.4, 2.4, -3.4);
    nextScene.add(hemi, key, fill, rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 40),
      new THREE.MeshStandardMaterial({ color: 0x12161a, roughness: 0.95, metalness: 0.04 })
    );
    floor.rotation.x = -Math.PI / 2;
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.01;
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false })
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.014;
    nextScene.add(floor, blob, core);
    shadow = blob;
    coreShadow = core;

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
    if (hold()) nextRenderer.render(nextScene, nextCam);
    else raf = requestAnimationFrame(frame);
  };

  return {
    async show(next) {
      look = next;
      disposed = false;
      if (renderer && scene) {
        const THREE = await import("three");
        threeRef = THREE;
        rebuildCar(THREE, next);
        sizeToHost();
        cancelAnimationFrame(raf);
        if (hold() && renderer && scene && camera) renderer.render(scene, camera);
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
