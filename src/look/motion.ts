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
