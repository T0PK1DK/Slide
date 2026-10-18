/**
 * Procedural low-poly storefronts. Shape + brand color only — no logo files.
 * Each recipe is a handful of boxes / cylinders so phones stay under ~250 tris.
 */
import { resolveHologramModelKey } from "./resolve";
import type { HologramModelKey } from "./keys";

type ThreeMod = typeof import("three");

export type StorePartKind = "box" | "cyl" | "cone" | "sphere" | "torus";

export type StorePart = {
  t: StorePartKind;
  /** Center position. Y is up; ground is 0. */
  p: [number, number, number];
  /** box: w,h,d · cyl/cone: r,h · sphere: r · torus: r,tube */
  s: [number, number, number] | [number, number] | [number];
  r?: [number, number, number];
  seg?: number;
  segY?: number;
};

export type StoreFamily = "grocery" | "pharmacy" | "fuel" | "food" | "coffee" | "retail" | "other";

export type StoreRecipe = {
  key: HologramModelKey;
  family: StoreFamily;
  parts: StorePart[];
};

function box(x: number, y: number, z: number, w: number, h: number, d: number, rx = 0, ry = 0, rz = 0): StorePart {
  const part: StorePart = { t: "box", p: [x, y, z], s: [w, h, d] };
  if (rx || ry || rz) part.r = [rx, ry, rz];
  return part;
}

function cyl(x: number, y: number, z: number, rad: number, h: number, seg = 8, rx = 0, ry = 0, rz = 0): StorePart {
  const part: StorePart = { t: "cyl", p: [x, y, z], s: [rad, h], seg };
  if (rx || ry || rz) part.r = [rx, ry, rz];
  return part;
}

function cone(x: number, y: number, z: number, rad: number, h: number, seg = 7): StorePart {
  return { t: "cone", p: [x, y, z], s: [rad, h], seg };
}

function sphere(x: number, y: number, z: number, rad: number, seg = 8, segY = 6): StorePart {
  return { t: "sphere", p: [x, y, z], s: [rad], seg, segY };
}

function torus(x: number, y: number, z: number, rad: number, tube: number, rx = 0, ry = 0, rz = 0, seg = 6, segY = 10): StorePart {
  const part: StorePart = { t: "torus", p: [x, y, z], s: [rad, tube], seg, segY };
  if (rx || ry || rz) part.r = [rx, ry, rz];
  return part;
}

const PI = Math.PI;

const RECIPES: Record<HologramModelKey, StoreRecipe> = {
  walmart: {
    key: "walmart",
    family: "grocery",
    parts: [
      box(0, 0.28, 0, 1.7, 0.56, 1.05),
      box(0, 0.58, 0, 1.76, 0.06, 1.1),
      box(0, 0.42, 0.58, 0.82, 0.08, 0.28),
      box(-0.42, 0.72, 0.52, 0.1, 0.28, 0.1),
      box(0.42, 0.72, 0.52, 0.1, 0.28, 0.1),
    ],
  },
  target: {
    key: "target",
    family: "retail",
    parts: [
      box(0, 0.3, 0, 1.15, 0.6, 0.86),
      box(0, 0.22, 0.48, 0.7, 0.06, 0.22),
      sphere(0, 0.52, 0.5, 0.22, 8, 6),
    ],
  },
  costco: {
    key: "costco",
    family: "grocery",
    parts: [
      box(0, 0.36, 0, 1.55, 0.72, 1.15),
      box(0, 0.86, 0, 1.62, 0.08, 0.2),
      box(-0.32, 0.92, 0, 0.9, 0.16, 1.18, 0, 0, 0.42),
      box(0.32, 0.92, 0, 0.9, 0.16, 1.18, 0, 0, -0.42),
      box(0.7, 0.18, 0.4, 0.28, 0.2, 0.36),
    ],
  },
  kroger: {
    key: "kroger",
    family: "grocery",
    parts: [
      box(0, 0.28, 0, 1.35, 0.56, 0.9),
      box(0, 0.5, 0.5, 0.7, 0.08, 0.2),
      box(0.62, 0.55, 0.2, 0.12, 0.7, 0.16),
      cyl(0.62, 0.96, 0.2, 0.09, 0.12, 8),
    ],
  },
  publix: {
    key: "publix",
    family: "grocery",
    parts: [
      box(-0.5, 0.24, 0, 0.55, 0.48, 0.82),
      box(0.5, 0.24, 0, 0.55, 0.48, 0.82),
      box(0, 0.34, 0.06, 0.55, 0.68, 0.7),
      cone(0, 0.82, 0.06, 0.36, 0.28, 6),
    ],
  },
  "whole-foods": {
    key: "whole-foods",
    family: "grocery",
    parts: [
      box(0, 0.26, 0, 1.2, 0.52, 0.84),
      box(0, 0.48, 0.48, 0.64, 0.08, 0.2),
      sphere(-0.18, 0.7, 0.4, 0.12, 7, 5),
      sphere(0.16, 0.74, 0.36, 0.15, 7, 5),
    ],
  },
  aldi: {
    key: "aldi",
    family: "grocery",
    parts: [
      box(0, 0.26, 0, 0.92, 0.52, 0.72),
      box(0, 0.5, 0.4, 0.8, 0.06, 0.16),
    ],
  },
  "trader-joes": {
    key: "trader-joes",
    family: "grocery",
    parts: [
      box(0, 0.22, 0, 1.0, 0.44, 0.72),
      cone(0, 0.62, 0, 0.62, 0.36, 6),
      cyl(0.28, 0.72, -0.08, 0.06, 0.28, 6),
      box(0, 0.16, 0.42, 0.55, 0.08, 0.18),
    ],
  },
  safeway: {
    key: "safeway",
    family: "grocery",
    parts: [
      box(0, 0.28, 0, 1.3, 0.56, 0.88),
      cyl(0, 0.42, 0.5, 0.28, 0.12, 8, PI / 2, 0, 0),
      box(0, 0.62, 0.48, 0.5, 0.1, 0.14),
    ],
  },
  albertsons: {
    key: "albertsons",
    family: "grocery",
    parts: [
      box(0, 0.26, 0, 1.28, 0.52, 0.86),
      box(-0.62, 0.62, 0.28, 0.12, 0.88, 0.12),
      sphere(-0.62, 1.12, 0.28, 0.1, 7, 5),
    ],
  },
  cvs: {
    key: "cvs",
    family: "pharmacy",
    parts: [
      box(0, 0.26, 0, 1.05, 0.52, 0.78),
      box(0, 0.5, 0.42, 0.9, 0.08, 0.16),
      box(0, 0.7, 0.02, 0.34, 0.08, 0.08),
      box(0, 0.7, 0.02, 0.08, 0.34, 0.08),
    ],
  },
  walgreens: {
    key: "walgreens",
    family: "pharmacy",
    parts: [
      box(0.12, 0.26, 0, 0.95, 0.52, 0.78),
      cyl(-0.42, 0.4, 0.28, 0.2, 0.8, 8),
      cone(-0.42, 0.92, 0.28, 0.22, 0.22, 7),
    ],
  },
  "rite-aid": {
    key: "rite-aid",
    family: "pharmacy",
    parts: [
      box(0, 0.26, 0, 1.02, 0.52, 0.76),
      box(0.52, 0.5, 0.3, 0.1, 0.64, 0.18),
      box(0, 0.48, 0.42, 0.7, 0.06, 0.14),
    ],
  },
  shell: {
    key: "shell",
    family: "fuel",
    parts: [
      box(-0.22, 0.12, 0.18, 0.12, 0.24, 0.12),
      box(0.22, 0.12, 0.18, 0.12, 0.24, 0.12),
      box(0, 0.42, 0, 1.15, 0.08, 0.85),
      sphere(-0.28, 0.5, 0.4, 0.12, 7, 5),
      sphere(0, 0.54, 0.42, 0.14, 7, 5),
      sphere(0.28, 0.5, 0.4, 0.12, 7, 5),
    ],
  },
  exxon: {
    key: "exxon",
    family: "fuel",
    parts: [
      box(-0.2, 0.12, 0.16, 0.12, 0.24, 0.12),
      box(0.2, 0.12, 0.16, 0.12, 0.24, 0.12),
      box(0, 0.4, 0, 1.1, 0.08, 0.8),
      box(0, 0.5, 0.02, 0.7, 0.06, 0.12),
      box(0, 0.6, 0.02, 0.7, 0.06, 0.12),
    ],
  },
  chevron: {
    key: "chevron",
    family: "fuel",
    parts: [
      box(-0.22, 0.12, 0.16, 0.12, 0.24, 0.12),
      box(0.22, 0.12, 0.16, 0.12, 0.24, 0.12),
      box(-0.16, 0.5, 0, 0.55, 0.08, 0.7, 0, 0, 0.7),
      box(0.16, 0.5, 0, 0.55, 0.08, 0.7, 0, 0, -0.7),
    ],
  },
  bp: {
    key: "bp",
    family: "fuel",
    parts: [
      box(-0.2, 0.12, 0.16, 0.12, 0.24, 0.12),
      box(0.2, 0.12, 0.16, 0.12, 0.24, 0.12),
      cyl(0, 0.4, 0, 0.52, 0.08, 10),
      sphere(0, 0.5, 0, 0.16, 7, 5),
    ],
  },
  "circle-k": {
    key: "circle-k",
    family: "fuel",
    parts: [
      box(0.18, 0.24, 0, 0.7, 0.48, 0.64),
      box(-0.42, 0.38, 0, 0.7, 0.08, 0.7),
      box(-0.5, 0.12, 0.16, 0.12, 0.22, 0.12),
      cyl(0.18, 0.3, 0.34, 0.12, 0.04, 8, PI / 2, 0, 0),
    ],
  },
  wawa: {
    key: "wawa",
    family: "fuel",
    parts: [
      box(0.2, 0.24, 0, 0.78, 0.48, 0.68),
      cyl(-0.42, 0.38, 0, 0.42, 0.08, 10),
      box(-0.42, 0.12, 0.18, 0.12, 0.22, 0.12),
      sphere(0.2, 0.56, 0.36, 0.1, 7, 5),
    ],
  },
  "7-eleven": {
    key: "7-eleven",
    family: "retail",
    parts: [
      box(0, 0.24, 0, 0.95, 0.48, 0.7),
      box(0, 0.5, 0.38, 0.95, 0.05, 0.12),
      box(0, 0.56, 0.38, 0.95, 0.05, 0.12),
      box(0, 0.62, 0.38, 0.95, 0.05, 0.12),
    ],
  },
  mcdonalds: {
    key: "mcdonalds",
    family: "food",
    parts: [
      box(0, 0.18, 0, 0.95, 0.36, 0.7),
      torus(-0.18, 0.58, 0.02, 0.26, 0.045, PI / 2, 0, 0.18, 6, 8),
      torus(0.18, 0.58, 0.02, 0.26, 0.045, PI / 2, 0, -0.18, 6, 8),
    ],
  },
  "burger-king": {
    key: "burger-king",
    family: "food",
    parts: [
      box(0, 0.18, 0, 0.95, 0.36, 0.68),
      cyl(0, 0.44, 0, 0.48, 0.1, 10),
      cyl(0, 0.56, 0, 0.4, 0.1, 10),
    ],
  },
  wendys: {
    key: "wendys",
    family: "food",
    parts: [
      box(0, 0.2, 0, 0.95, 0.4, 0.7),
      box(0, 0.52, 0, 1.05, 0.16, 0.82, 0.35, 0, 0),
    ],
  },
  "taco-bell": {
    key: "taco-bell",
    family: "food",
    parts: [
      box(0, 0.2, 0, 1.05, 0.4, 0.72),
      cyl(-0.28, 0.32, 0.4, 0.14, 0.06, 8, PI / 2, 0, 0),
      cyl(0.28, 0.32, 0.4, 0.14, 0.06, 8, PI / 2, 0, 0),
      cone(0, 0.62, 0.08, 0.16, 0.28, 7),
      sphere(0, 0.8, 0.08, 0.07, 6, 5),
    ],
  },
  "chick-fil-a": {
    key: "chick-fil-a",
    family: "food",
    parts: [
      box(0, 0.18, 0, 0.95, 0.36, 0.68),
      box(-0.18, 0.52, 0, 0.7, 0.08, 0.78, 0, 0, 0.72),
      box(0.18, 0.52, 0, 0.7, 0.08, 0.78, 0, 0, -0.72),
    ],
  },
  subway: {
    key: "subway",
    family: "food",
    parts: [
      box(0, 0.18, 0, 1.45, 0.36, 0.48),
      box(0, 0.38, 0.26, 1.45, 0.06, 0.12),
    ],
  },
  chipotle: {
    key: "chipotle",
    family: "food",
    parts: [
      box(0, 0.26, 0, 1.0, 0.52, 0.76),
      box(0, 0.56, 0, 1.06, 0.08, 0.82),
      cyl(0.32, 0.74, -0.12, 0.08, 0.28, 6),
    ],
  },
  starbucks: {
    key: "starbucks",
    family: "coffee",
    parts: [
      box(0, 0.24, 0, 0.92, 0.48, 0.7),
      box(0, 0.46, 0.38, 0.7, 0.06, 0.14),
      torus(0, 0.3, 0.38, 0.16, 0.03, 0, 0, 0, 6, 10),
      cyl(0, 0.3, 0.38, 0.12, 0.02, 8, PI / 2, 0, 0),
    ],
  },
  dunkin: {
    key: "dunkin",
    family: "coffee",
    parts: [
      box(0, 0.22, 0, 0.95, 0.44, 0.68),
      box(0, 0.46, 0.38, 0.95, 0.1, 0.14),
      cyl(-0.16, 0.18, 0.42, 0.07, 0.14, 7),
      cyl(0.16, 0.18, 0.42, 0.07, 0.14, 7),
    ],
  },
  "home-depot": {
    key: "home-depot",
    family: "retail",
    parts: [
      box(0, 0.34, 0, 1.55, 0.68, 1.05),
      box(0, 0.62, 0.58, 1.2, 0.1, 0.22),
      box(0.7, 0.16, 0.5, 0.32, 0.18, 0.4),
    ],
  },
  lowes: {
    key: "lowes",
    family: "retail",
    parts: [
      box(0, 0.32, 0, 1.45, 0.64, 1.0),
      box(-0.3, 0.76, 0, 0.85, 0.14, 1.04, 0, 0, 0.4),
      box(0.3, 0.76, 0, 0.85, 0.14, 1.04, 0, 0, -0.4),
    ],
  },
  "best-buy": {
    key: "best-buy",
    family: "retail",
    parts: [
      box(0, 0.28, 0, 1.15, 0.56, 0.82),
      box(0.52, 0.4, 0.36, 0.1, 0.56, 0.14),
      cyl(0.52, 0.82, 0.36, 0.03, 0.28, 6),
    ],
  },
  "generic-grocery": {
    key: "generic-grocery",
    family: "grocery",
    parts: [box(0, 0.24, 0, 1.15, 0.48, 0.8), cone(0, 0.62, 0, 0.42, 0.28, 6)],
  },
  "generic-pharmacy": {
    key: "generic-pharmacy",
    family: "pharmacy",
    parts: [
      box(0, 0.24, 0, 0.95, 0.48, 0.72),
      box(0, 0.62, 0, 0.28, 0.07, 0.07),
      box(0, 0.62, 0, 0.07, 0.28, 0.07),
    ],
  },
  "generic-fuel": {
    key: "generic-fuel",
    family: "fuel",
    parts: [box(0, 0.12, 0.14, 0.12, 0.24, 0.12), box(0, 0.4, 0, 1.0, 0.08, 0.75)],
  },
  "generic-fast_food": {
    key: "generic-fast_food",
    family: "food",
    parts: [box(0, 0.2, 0, 0.95, 0.4, 0.68), box(0.55, 0.28, 0.1, 0.28, 0.08, 0.5)],
  },
  "generic-coffee": {
    key: "generic-coffee",
    family: "coffee",
    parts: [box(0, 0.22, 0, 0.85, 0.44, 0.64), cyl(0.38, 0.2, 0.28, 0.1, 0.18, 7)],
  },
  "generic-retail": {
    key: "generic-retail",
    family: "retail",
    parts: [box(0, 0.26, 0, 1.1, 0.52, 0.78), box(0, 0.28, 0.4, 0.7, 0.22, 0.04)],
  },
  "generic-other": {
    key: "generic-other",
    family: "other",
    parts: [box(0, 0.22, 0, 0.85, 0.44, 0.7), cone(0, 0.58, 0, 0.52, 0.28, 6)],
  },
  "*": {
    key: "*",
    family: "other",
    parts: [box(0, 0.2, 0, 0.72, 0.4, 0.6), cone(0, 0.52, 0, 0.44, 0.24, 5)],
  },
};

export function storeRecipe(modelKey: string): StoreRecipe {
  return RECIPES[resolveHologramModelKey(modelKey)];
}

export function storeSignature(modelKey: string): string {
  const recipe = storeRecipe(modelKey);
  return recipe.parts
    .map((p) => {
      const pos = p.p.map((n) => n.toFixed(2)).join(",");
      const size = p.s.map((n) => n.toFixed(2)).join(",");
      return `${p.t}@${pos}#${size}`;
    })
    .join("|");
}

export function estimateStoreTriangles(modelKey: string): number {
  return storeRecipe(modelKey).parts.reduce((sum, p) => sum + partTriangles(p), 0);
}

function partTriangles(p: StorePart): number {
  const seg = p.seg ?? 8;
  const segY = p.segY ?? 6;
  if (p.t === "box") return 12;
  if (p.t === "cyl") return seg * 4;
  if (p.t === "cone") return seg * 2;
  if (p.t === "sphere") return seg * segY * 2;
  return seg * segY * 2;
}

export function buildStoreGroup(THREE: ThreeMod, modelKey: string, fill: unknown, edge: unknown) {
  const group = new THREE.Group();
  const recipe = storeRecipe(modelKey);
  for (const part of recipe.parts) {
    const geo = partGeometry(THREE, part);
    const mesh = new THREE.Mesh(geo, fill);
    mesh.position.set(part.p[0], part.p[1], part.p[2]);
    if (part.r) mesh.rotation.set(part.r[0], part.r[1], part.r[2]);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 22), edge);
    lines.position.copy(mesh.position);
    lines.rotation.copy(mesh.rotation);
    group.add(mesh, lines);
  }
  return group;
}

function partGeometry(THREE: ThreeMod, part: StorePart) {
  const seg = part.seg ?? 8;
  const segY = part.segY ?? 6;
  if (part.t === "box") {
    const [w, h, d] = part.s as [number, number, number];
    return new THREE.BoxGeometry(w, h, d);
  }
  if (part.t === "cyl") {
    const [rad, h] = part.s as [number, number];
    return new THREE.CylinderGeometry(rad, rad, h, seg);
  }
  if (part.t === "cone") {
    const [rad, h] = part.s as [number, number];
    return new THREE.ConeGeometry(rad, h, seg);
  }
  if (part.t === "sphere") {
    const [rad] = part.s as [number];
    return new THREE.SphereGeometry(rad, seg, segY);
  }
  const [rad, tube] = part.s as [number, number];
  return new THREE.TorusGeometry(rad, tube, seg, segY);
}
