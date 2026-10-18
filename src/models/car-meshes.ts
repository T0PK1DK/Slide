/**
 * Low-poly ghost hulls. Five types, colored by the friend's paint.
 * Not the garage showroom cars — those stay in src/lib/game/carMeshes.ts.
 */
import { resolveGhostCarKey } from "./resolve";
import type { GhostCarKey } from "./keys";

type ThreeMod = typeof import("three");

type CarPart = {
  t: "box" | "cyl";
  p: [number, number, number];
  s: [number, number, number] | [number, number];
  r?: [number, number, number];
};

const PI = Math.PI;

function box(x: number, y: number, z: number, w: number, h: number, d: number): CarPart {
  return { t: "box", p: [x, y, z], s: [w, h, d] };
}

function wheel(x: number, z: number): CarPart {
  return { t: "cyl", p: [x, 0.08, z], s: [0.08, 0.07], r: [0, 0, PI / 2] };
}

const HULLS: Record<GhostCarKey, CarPart[]> = {
  sedan: [
    box(0, 0.16, 0, 0.42, 0.16, 0.9),
    box(0, 0.3, -0.04, 0.36, 0.16, 0.42),
    wheel(-0.2, 0.28),
    wheel(0.2, 0.28),
    wheel(-0.2, -0.28),
    wheel(0.2, -0.28),
  ],
  suv: [
    box(0, 0.2, 0, 0.48, 0.22, 0.92),
    box(0, 0.4, -0.02, 0.44, 0.22, 0.55),
    box(0, 0.52, -0.04, 0.3, 0.04, 0.4),
    wheel(-0.22, 0.3),
    wheel(0.22, 0.3),
    wheel(-0.22, -0.3),
    wheel(0.22, -0.3),
  ],
  pickup: [
    box(0, 0.18, 0.16, 0.46, 0.18, 0.5),
    box(0, 0.34, 0.2, 0.4, 0.18, 0.32),
    box(0, 0.16, -0.28, 0.44, 0.1, 0.42),
    box(-0.2, 0.24, -0.28, 0.04, 0.14, 0.4),
    box(0.2, 0.24, -0.28, 0.04, 0.14, 0.4),
    wheel(-0.22, 0.28),
    wheel(0.22, 0.28),
    wheel(-0.22, -0.32),
    wheel(0.22, -0.32),
  ],
  sports: [
    box(0, 0.12, 0.04, 0.44, 0.1, 1.02),
    box(0, 0.2, -0.06, 0.38, 0.1, 0.4),
    box(0, 0.22, -0.46, 0.4, 0.04, 0.12),
    wheel(-0.2, 0.32),
    wheel(0.2, 0.32),
    wheel(-0.2, -0.3),
    wheel(0.2, -0.3),
  ],
  default: [
    box(0, 0.14, 0, 0.36, 0.14, 0.82),
    box(0, 0.24, -0.08, 0.28, 0.12, 0.34),
    wheel(-0.18, 0.26),
    wheel(0.18, 0.26),
    wheel(-0.18, -0.26),
    wheel(0.18, -0.26),
  ],
};

export function ghostCarKind(carModelKey: string): GhostCarKey {
  return resolveGhostCarKey(carModelKey);
}

export function ghostCarSignature(carModelKey: string): string {
  const kind = ghostCarKind(carModelKey);
  return HULLS[kind].map((p) => `${p.t}:${p.s.join(",")}`).join("|");
}

export function buildGhostCarGroup(THREE: ThreeMod, carModelKey: string, fill: unknown, edge: unknown) {
  const group = new THREE.Group();
  const kind = ghostCarKind(carModelKey);
  for (const part of HULLS[kind]) {
    const geo =
      part.t === "box"
        ? new THREE.BoxGeometry(...(part.s as [number, number, number]))
        : new THREE.CylinderGeometry(part.s[0], part.s[0], part.s[1], 8);
    const mesh = new THREE.Mesh(geo, fill);
    mesh.position.set(part.p[0], part.p[1], part.p[2]);
    if (part.r) mesh.rotation.set(part.r[0], part.r[1], part.r[2]);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edge);
    lines.position.copy(mesh.position);
    lines.rotation.copy(mesh.rotation);
    group.add(mesh, lines);
  }
  return group;
}
