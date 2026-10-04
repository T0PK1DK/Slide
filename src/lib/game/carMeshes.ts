/**
 * Original low-poly Slide rides for the unlock stage.
 * Hulls are lofted superellipses — no licensed brand shapes, no model files.
 */
import type { Livery, VehicleId } from "../vehicles";
import { ALL_VEHICLES } from "../vehicles";

export type CarStageLook = {
  vehicle: VehicleId;
  livery: Livery;
  paint: string;
  accent: string;
};

export type RideShape = "hyper" | "coupe" | "hatch" | "suv" | "pickup" | "wedge" | "touring" | "wagon";

export type RideSpec = {
  w: number;
  h: number;
  l: number;
  cab: number;
  bed: number;
  shape: RideShape;
  wheelR: number;
  ride: number;
  round: number;
};

type Station = { z: number; y: number; w: number; h: number };

type ThreeMod = typeof import("three");

const SPECS: Record<VehicleId, RideSpec> = {
  slipstream: { w: 1.1, h: 0.36, l: 2.16, cab: 0.22, bed: 0, shape: "hyper", wheelR: 0.2, ride: 0.08, round: 0.62 },
  brawler: { w: 1.12, h: 0.5, l: 2.08, cab: 0.28, bed: 0, shape: "coupe", wheelR: 0.22, ride: 0.1, round: 0.48 },
  hatch: { w: 1.0, h: 0.56, l: 1.68, cab: 0.34, bed: 0, shape: "hatch", wheelR: 0.2, ride: 0.1, round: 0.5 },
  ridge: { w: 1.18, h: 0.72, l: 2.08, cab: 0.36, bed: 0, shape: "suv", wheelR: 0.26, ride: 0.16, round: 0.38 },
  hauler: { w: 1.16, h: 0.58, l: 2.3, cab: 0.3, bed: 0.86, shape: "pickup", wheelR: 0.24, ride: 0.14, round: 0.4 },
  classic: { w: 1.02, h: 0.42, l: 1.9, cab: 0.2, bed: 0, shape: "wedge", wheelR: 0.18, ride: 0.07, round: 0.7 },
  nimbus: { w: 1.08, h: 0.42, l: 2.24, cab: 0.26, bed: 0, shape: "touring", wheelR: 0.21, ride: 0.09, round: 0.58 },
  glider: { w: 1.14, h: 0.46, l: 2.4, cab: 0.28, bed: 0, shape: "wagon", wheelR: 0.21, ride: 0.09, round: 0.52 },
};

const HULLS: Record<VehicleId, Station[]> = {
  slipstream: [
    { z: 1.08, y: 0.2, w: 0.46, h: 0.16 },
    { z: 0.72, y: 0.24, w: 0.8, h: 0.24 },
    { z: 0.3, y: 0.28, w: 1.02, h: 0.32 },
    { z: -0.08, y: 0.3, w: 1.06, h: 0.34 },
    { z: -0.46, y: 0.32, w: 1.12, h: 0.36 },
    { z: -0.86, y: 0.28, w: 1.02, h: 0.3 },
    { z: -1.08, y: 0.22, w: 0.86, h: 0.2 },
  ],
  brawler: [
    { z: 1.04, y: 0.28, w: 0.78, h: 0.28 },
    { z: 0.52, y: 0.32, w: 1.06, h: 0.38 },
    { z: 0.08, y: 0.4, w: 1.12, h: 0.5 },
    { z: -0.3, y: 0.42, w: 1.1, h: 0.52 },
    { z: -0.66, y: 0.34, w: 1.08, h: 0.4 },
    { z: -1.02, y: 0.3, w: 1.04, h: 0.34 },
  ],
  hatch: [
    { z: 0.78, y: 0.28, w: 0.72, h: 0.3 },
    { z: 0.38, y: 0.36, w: 0.96, h: 0.44 },
    { z: 0.02, y: 0.42, w: 1.0, h: 0.54 },
    { z: -0.36, y: 0.44, w: 1.0, h: 0.58 },
    { z: -0.7, y: 0.4, w: 0.96, h: 0.52 },
    { z: -0.86, y: 0.3, w: 0.88, h: 0.36 },
  ],
  ridge: [
    { z: 0.98, y: 0.44, w: 0.92, h: 0.44 },
    { z: 0.52, y: 0.54, w: 1.14, h: 0.62 },
    { z: 0.08, y: 0.6, w: 1.18, h: 0.72 },
    { z: -0.38, y: 0.62, w: 1.18, h: 0.74 },
    { z: -0.82, y: 0.56, w: 1.14, h: 0.64 },
    { z: -1.04, y: 0.46, w: 1.06, h: 0.48 },
  ],
  hauler: [
    { z: 1.08, y: 0.36, w: 0.88, h: 0.36 },
    { z: 0.62, y: 0.42, w: 1.12, h: 0.5 },
    { z: 0.22, y: 0.46, w: 1.16, h: 0.56 },
    { z: -0.12, y: 0.44, w: 1.14, h: 0.5 },
  ],
  classic: [
    { z: 0.96, y: 0.14, w: 0.26, h: 0.1 },
    { z: 0.52, y: 0.2, w: 0.6, h: 0.2 },
    { z: 0.08, y: 0.26, w: 0.88, h: 0.3 },
    { z: -0.36, y: 0.32, w: 1.0, h: 0.38 },
    { z: -0.82, y: 0.36, w: 1.04, h: 0.44 },
  ],
  nimbus: [
    { z: 1.12, y: 0.26, w: 0.7, h: 0.26 },
    { z: 0.62, y: 0.3, w: 0.98, h: 0.34 },
    { z: 0.14, y: 0.34, w: 1.06, h: 0.4 },
    { z: -0.32, y: 0.36, w: 1.08, h: 0.42 },
    { z: -0.74, y: 0.32, w: 1.02, h: 0.36 },
    { z: -1.12, y: 0.26, w: 0.9, h: 0.26 },
  ],
  glider: [
    { z: 1.16, y: 0.26, w: 0.8, h: 0.28 },
    { z: 0.62, y: 0.32, w: 1.08, h: 0.38 },
    { z: 0.1, y: 0.36, w: 1.12, h: 0.44 },
    { z: -0.42, y: 0.38, w: 1.14, h: 0.46 },
    { z: -0.88, y: 0.36, w: 1.12, h: 0.44 },
    { z: -1.2, y: 0.28, w: 0.98, h: 0.3 },
  ],
};

const CABINS: Partial<Record<VehicleId, Station[]>> = {
  slipstream: [
    { z: 0.22, y: 0.48, w: 0.72, h: 0.2 },
    { z: -0.08, y: 0.52, w: 0.78, h: 0.24 },
    { z: -0.4, y: 0.48, w: 0.74, h: 0.2 },
  ],
  brawler: [
    { z: 0.02, y: 0.66, w: 0.86, h: 0.22 },
    { z: -0.28, y: 0.7, w: 0.88, h: 0.26 },
    { z: -0.52, y: 0.62, w: 0.82, h: 0.18 },
  ],
  hatch: [
    { z: 0.12, y: 0.7, w: 0.8, h: 0.24 },
    { z: -0.22, y: 0.76, w: 0.84, h: 0.3 },
    { z: -0.58, y: 0.7, w: 0.8, h: 0.24 },
  ],
  ridge: [
    { z: 0.28, y: 0.96, w: 0.96, h: 0.22 },
    { z: -0.2, y: 1.02, w: 1.0, h: 0.28 },
    { z: -0.7, y: 0.96, w: 0.96, h: 0.22 },
  ],
  hauler: [
    { z: 0.55, y: 0.74, w: 0.9, h: 0.22 },
    { z: 0.22, y: 0.8, w: 0.94, h: 0.28 },
    { z: -0.08, y: 0.74, w: 0.9, h: 0.2 },
  ],
  classic: [
    { z: 0.12, y: 0.42, w: 0.42, h: 0.16 },
    { z: -0.22, y: 0.52, w: 0.62, h: 0.22 },
    { z: -0.55, y: 0.48, w: 0.7, h: 0.16 },
  ],
  nimbus: [
    { z: 0.18, y: 0.56, w: 0.8, h: 0.2 },
    { z: -0.22, y: 0.6, w: 0.86, h: 0.24 },
    { z: -0.62, y: 0.54, w: 0.8, h: 0.18 },
  ],
  glider: [
    { z: 0.28, y: 0.58, w: 0.88, h: 0.2 },
    { z: -0.2, y: 0.64, w: 0.94, h: 0.26 },
    { z: -0.78, y: 0.6, w: 0.92, h: 0.22 },
    { z: -1.02, y: 0.5, w: 0.84, h: 0.14 },
  ],
};

export function rideSpec(id: string): RideSpec {
  return SPECS[id as VehicleId] ?? SPECS.slipstream;
}

export function rideSilhouette(id: string): { id: string; shape: RideShape; l: number; w: number; h: number; bed: number } {
  const s = rideSpec(id);
  return { id, shape: s.shape, l: s.l, w: s.w, h: s.h, bed: s.bed };
}

const BRANDS = /porsche|ferrari|bmw|toyota|ford|honda|tesla|lambo|corvette|mustang|civic/i;

export function rideNamesAreOriginal(): boolean {
  return ALL_VEHICLES.every((v) => !BRANDS.test(`${v.name} ${v.kind} ${v.id}`));
}

function hex(value: string, fallback: number): number {
  const n = Number.parseInt(value.replace("#", ""), 16);
  return Number.isFinite(n) ? n : fallback;
}

function css(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function canvasTex(THREE: ThreeMod, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  paint(ctx, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function liveryMaps(THREE: ThreeMod, look: CarStageLook, paint: number, accent: number) {
  const p = css(paint);
  const a = css(accent);
  if (look.livery === "stripes") {
    return canvasTex(THREE, (ctx, w, h) => {
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = a;
      ctx.fillRect(w * 0.2, 0, w * 0.045, h);
      ctx.fillRect(w * 0.27, 0, w * 0.045, h);
    });
  }
  if (look.livery === "fade") {
    return canvasTex(THREE, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, p);
      g.addColorStop(0.45, p);
      g.addColorStop(1, a);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  if (look.livery === "halo") {
    return canvasTex(THREE, (ctx, w, h) => {
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = a;
      ctx.fillRect(w * 0.232, 0, w * 0.036, h);
    });
  }
  return null;
}

function loft(THREE: ThreeMod, stations: Station[], segs: number, round: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const pwr = Math.max(0.28, Math.min(0.9, round));
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    for (let j = 0; j < segs; j++) {
      const t = (j / segs) * Math.PI * 2;
      const ct = Math.cos(t);
      const st = Math.sin(t);
      const x = (s.w / 2) * Math.sign(ct || 1) * Math.pow(Math.abs(ct), pwr);
      const y = s.y + (s.h / 2) * Math.sign(st || 1) * Math.pow(Math.abs(st), pwr * 1.15);
      positions.push(x, y, s.z);
      uvs.push(j / segs, i / (stations.length - 1));
    }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j;
      const b = i * segs + ((j + 1) % segs);
      const c = (i + 1) * segs + j;
      const d = (i + 1) * segs + ((j + 1) % segs);
      indices.push(a, c, b, b, c, d);
    }
  }
  const cap = (si: number, reverse: boolean) => {
    const s = stations[si];
    const center = positions.length / 3;
    positions.push(0, s.y, s.z);
    uvs.push(0.5, si / (stations.length - 1));
    for (let j = 0; j < segs; j++) {
      const a = si * segs + j;
      const b = si * segs + ((j + 1) % segs);
      if (reverse) indices.push(center, b, a);
      else indices.push(center, a, b);
    }
  };
  cap(0, true);
  cap(stations.length - 1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addWheel(THREE: ThreeMod, group: InstanceType<ThreeMod["Group"]>, x: number, y: number, z: number, r: number, width: number, rubber: unknown, rim: unknown, hub: unknown) {
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 16), rubber);
  tire.rotation.z = Math.PI / 2;
  tire.position.set(x, y, z);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.68, r * 0.68, width * 1.08, 14), rim);
  lip.rotation.z = Math.PI / 2;
  lip.position.set(x, y, z);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, width * 1.16, 10), hub);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(x, y, z);
  group.add(tire, lip, cap);
}

export function buildCar(THREE: ThreeMod, look: CarStageLook) {
  const id = (ALL_VEHICLES.some((v) => v.id === look.vehicle) ? look.vehicle : "slipstream") as VehicleId;
  const spec = SPECS[id];
  const hull = HULLS[id];
  const group = new THREE.Group();
  const paint = hex(look.paint, 0xe8eef2);
  const accent = hex(look.accent, 0xf0a04b);
  const map = liveryMaps(THREE, look, paint, accent);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: paint,
    metalness: 0.42,
    roughness: 0.36,
    map,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.3,
    roughness: 0.4,
    emissive: accent,
    emissiveIntensity: 0.2,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: look.livery === "dusk" ? accent : paint,
    metalness: 0.35,
    roughness: look.livery === "dusk" ? 0.55 : 0.4,
    emissive: look.livery === "dusk" ? accent : 0x000000,
    emissiveIntensity: look.livery === "dusk" ? 0.08 : 0,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8fb4d8,
    metalness: 0.85,
    roughness: 0.08,
    transparent: true,
    opacity: 0.38,
    envMapIntensity: 1,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.92, metalness: 0.05 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.75, roughness: 0.28 });
  const hub = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.55, roughness: 0.35 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff1c4, emissiveIntensity: 0.85, roughness: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2a2a, emissiveIntensity: 0.7, roughness: 0.35 });

  const segs = 12;
  group.add(new THREE.Mesh(loft(THREE, hull, segs, spec.round), bodyMat));

  const cabin = CABINS[id];
  if (cabin) {
    const cabMesh = new THREE.Mesh(loft(THREE, cabin, 10, Math.min(0.75, spec.round + 0.12)), look.livery === "dusk" ? roofMat : glassMat);
    group.add(cabMesh);
  }

  if (id === "hauler") {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.9, 0.06, spec.bed), bodyMat);
    floor.position.set(0, spec.ride + 0.22, -0.72);
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, spec.bed * 0.92), bodyMat);
    wallL.position.set(-spec.w * 0.42, spec.ride + 0.36, -0.72);
    const wallR = wallL.clone();
    wallR.position.x = spec.w * 0.42;
    const gate = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.86, 0.24, 0.05), bodyMat);
    gate.position.set(0, spec.ride + 0.32, -1.14);
    group.add(floor, wallL, wallR, gate);
  }

  if (id === "ridge") {
    for (const x of [-0.28, 0.28]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.15, 6), rubber);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 1.14, -0.18);
      group.add(rail);
    }
  }

  if (id === "slipstream") {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.16), accentMat);
    wing.position.set(0, 0.42, -1.02);
    group.add(wing);
  }

  if (look.livery === "halo") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 22), accentMat);
    ring.rotation.x = Math.PI / 2;
    const top = cabin?.[1] ?? { y: 0.55, z: -0.1 };
    ring.position.set(0, top.y + 0.16, top.z);
    group.add(ring);
  }

  const first = hull[0];
  const last = hull[hull.length - 1];
  const hx = first.w * 0.22;
  for (const x of [-hx, hx]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(id === "classic" ? 0.04 : 0.055, 10, 8), lightMat);
    lamp.scale.set(1.15, 0.7, 0.7);
    lamp.position.set(x, first.y, first.z + 0.02);
    group.add(lamp);
  }
  const tx = last.w * 0.28;
  for (const x of [-tx, tx]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.03), tailMat);
    lamp.position.set(x, last.y + last.h * 0.15, last.z - 0.01);
    group.add(lamp);
  }

  const wheelY = spec.wheelR;
  const frontZ = hull[1]?.z ?? spec.l * 0.28;
  const rearZ = (id === "hauler" ? -0.82 : hull[hull.length - 2]?.z) ?? -spec.l * 0.3;
  const axleX = spec.w * 0.48;
  const width = spec.shape === "suv" || spec.shape === "pickup" ? 0.18 : 0.15;
  for (const [x, z] of [
    [-axleX, frontZ],
    [axleX, frontZ],
    [-axleX, rearZ],
    [axleX, rearZ],
  ] as const) {
    addWheel(THREE, group, x, wheelY, z, spec.wheelR, width, rubber, rim, hub);
  }

  const glow = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.72, 0.02, spec.l * 0.7), accentMat);
  glow.position.y = 0.03;
  group.add(glow);

  group.rotation.y = Math.PI * 0.22;
  return group;
}
