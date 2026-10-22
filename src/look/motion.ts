/**
 * Look motion math. MapLibre paints and CSS read these — no backend,
 * no hologram register hook.
 */

export const PIN_DROP_MS = 560;
export const PIN_DROP_LIFT = 28;
export const PIN_SELECT_MS = 300;
export const PIN_SELECT_START = 0.82;
export const PIN_SELECT_PEAK = 1.08;
export const CARD_ENTER_MS = 420;
export const HALO_PULSE_MS = 2400;

export function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

/** Teardrop drop-in: starts above the point and fades on. */
export function pinDropPaint(progress: number): { translate: [number, number]; opacity: number } {
  const e = easeOutCubic(progress);
  const lift = Math.round((1 - e) * -PIN_DROP_LIFT);
  return {
    translate: [0, lift === 0 ? 0 : lift],
    opacity: Math.round(e * 1000) / 1000,
  };
}

/** Selected pin pops from rest size, overshoots, then lands. */
export function pinSelectScale(progress: number): number {
  const e = easeOutCubic(progress);
  if (progress >= 1) return 1;
  if (e < 0.72) {
    const t = e / 0.72;
    return Math.round((PIN_SELECT_START + (PIN_SELECT_PEAK - PIN_SELECT_START) * t) * 1000) / 1000;
  }
  const t = (e - 0.72) / 0.28;
  return Math.round((PIN_SELECT_PEAK + (1 - PIN_SELECT_PEAK) * t) * 1000) / 1000;
}

/** Sprite CSS px is 64; these stay near 0.5 so the pin does not grow with zoom. */
export const PIN_SIZE_REST = 0.5;
export const PIN_SIZE_HOT = 0.58;

export function selectedPinSizeExpr(scale = 1): unknown[] {
  return ["*", ["interpolate", ["linear"], ["zoom"], 10, PIN_SIZE_HOT, 18, PIN_SIZE_HOT + 0.02], scale];
}

/** Soft breathe for the selected-pin halo. */
export function haloPulse(nowMs: number): { radiusBoost: number; opacity: number } {
  const t = ((nowMs % HALO_PULSE_MS) + HALO_PULSE_MS) % HALO_PULSE_MS;
  const s = 0.5 - 0.5 * Math.cos((t / HALO_PULSE_MS) * Math.PI * 2);
  return {
    radiusBoost: 3 + s * 7,
    opacity: Math.round((0.22 + s * 0.2) * 1000) / 1000,
  };
}

export function pinSizeExpr(selected: string | null): unknown[] {
  const rest: unknown[] = ["interpolate", ["linear"], ["zoom"], 10, PIN_SIZE_REST, 18, PIN_SIZE_REST + 0.02];
  const hot: unknown[] = ["interpolate", ["linear"], ["zoom"], 10, PIN_SIZE_HOT, 18, PIN_SIZE_HOT + 0.02];
  if (!selected) return rest;
  return ["case", ["==", ["get", "id"], selected], hot, rest];
}

export function haloRadiusExpr(boost: number): unknown[] {
  return ["+", ["interpolate", ["linear"], ["zoom"], 11, 14, 16, 28], boost];
}

export function storeIdsKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

/** Street-zoom teardrops closer than this fade so the selected / nearer pin wins. */
export const PIN_COLLIDE_M = 56;
export const PIN_FADE_NEAR = 0.38;

export type PinPoint = { id: string; lon: number; lat: number };
export type PinRank = { sortKey: number; fade: number };

function distM(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

/**
 * Lower sortKey is placed first (keeps the label). Selected is 0.
 * Pins stacked on the selected / a nearer neighbor fade.
 */
export function rankPins(
  points: PinPoint[],
  opts: { center: { lon: number; lat: number }; selected: string | null },
): Map<string, PinRank> {
  const selected = opts.selected;
  const ranked = points.map((p) => {
    const toCenter = distM(opts.center, p);
    const sortKey = p.id === selected ? 0 : Math.max(1, Math.round(toCenter));
    return { ...p, sortKey, toCenter };
  });
  ranked.sort((a, b) => a.sortKey - b.sortKey || a.toCenter - b.toCenter);
  const out = new Map<string, PinRank>();
  for (let i = 0; i < ranked.length; i++) {
    const p = ranked[i]!;
    let fade = 1;
    if (p.id !== selected) {
      const hit = ranked.slice(0, i).some((other) => distM(p, other) < PIN_COLLIDE_M);
      if (hit) fade = PIN_FADE_NEAR;
    }
    out.set(p.id, { sortKey: p.sortKey, fade });
  }
  return out;
}
