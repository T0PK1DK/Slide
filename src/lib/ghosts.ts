import type { LonLat } from "./valhalla";

export type GhostSample = {
  lon: number;
  lat: number;
  bearing: number;
};

export type GhostCar = {
  id: string;
  tag: string;
  color: string;
  offset: number;
  speed: number;
  samples: GhostSample[];
  t: number;
};

function bearing(a: [number, number], b: [number, number]): number {
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function samplesFromLine(coords: [number, number][]): GhostSample[] {
  const out: GhostSample[] = [];
  for (let i = 0; i < coords.length; i++) {
    const cur = coords[i];
    const nxt = coords[Math.min(i + 1, coords.length - 1)];
    out.push({ lon: cur[0], lat: cur[1], bearing: bearing(cur, nxt) });
  }
  return out;
}

export function seedGhosts(coords: [number, number][], yourTag: string): GhostCar[] {
  if (coords.length < 8) return [];
  const base = samplesFromLine(coords);
  const roster = [
    { tag: "NOVA", color: "#b388ff", offset: 0.12, speed: 1.04 },
    { tag: "KITE", color: "#8fd3ff", offset: 0.31, speed: 0.92 },
    { tag: "VEX", color: "#ff8a4c", offset: 0.58, speed: 1.12 },
    { tag: yourTag.slice(0, 8) || "YOU", color: "#ffffff", offset: 0.78, speed: 0.97 },
  ];
  return roster.map((r, i) => ({
    id: `g${i}`,
    tag: r.tag,
    color: r.color,
    offset: r.offset,
    speed: r.speed,
    samples: base,
    t: r.offset,
  }));
}

export function stepGhost(g: GhostCar, dt: number): GhostSample {
  g.t = (g.t + dt * g.speed * 0.018) % 1;
  const idx = g.t * (g.samples.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const a = g.samples[i];
  const b = g.samples[Math.min(i + 1, g.samples.length - 1)];
  return {
    lon: a.lon + (b.lon - a.lon) * f,
    lat: a.lat + (b.lat - a.lat) * f,
    bearing: a.bearing + ((((b.bearing - a.bearing + 540) % 360) - 180) * f),
  };
}

export function chasePoint(
  coords: [number, number][],
  t: number
): { pos: LonLat; bearing: number } {
  if (!coords.length) return { pos: { lon: 0, lat: 0 }, bearing: 0 };
  const idx = Math.max(0, Math.min(1, t)) * (coords.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const a = coords[i];
  const b = coords[Math.min(i + 1, coords.length - 1)];
  return {
    pos: { lon: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f },
    bearing: bearing(a, b),
  };
}
