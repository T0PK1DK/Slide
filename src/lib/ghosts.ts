
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

/*
 * No invented drivers. The old seedGhosts() put fake cars ("NOVA", "KITE",
 * "VEX", plus a pretend "you") on every route as if they were real people.
 * Ghosts come back only from real data: your own recorded run on the same
 * route (pace ghost), or opt-in friends once presence exists (docs/STRATEGY.md).
 */

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
