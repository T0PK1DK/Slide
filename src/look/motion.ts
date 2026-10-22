/**
 * Look motion math. MapLibre paints and CSS read these — no backend,
 * no hologram register hook.
 */

export const PIN_DROP_MS = 520;
export const PIN_DROP_LIFT = 20;
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

/** Soft breathe for the selected-pin halo. */
export function haloPulse(nowMs: number): { radiusBoost: number; opacity: number } {
  const t = ((nowMs % HALO_PULSE_MS) + HALO_PULSE_MS) % HALO_PULSE_MS;
  const s = 0.5 - 0.5 * Math.cos((t / HALO_PULSE_MS) * Math.PI * 2);
  return {
    radiusBoost: 2 + s * 5,
    opacity: Math.round((0.16 + s * 0.14) * 1000) / 1000,
  };
}

export function pinSizeExpr(selected: string | null): unknown[] {
  const rest: unknown[] = ["interpolate", ["linear"], ["zoom"], 10, 0.82, 13, 1.02, 16, 1.2];
  const hot: unknown[] = ["interpolate", ["linear"], ["zoom"], 10, 1.02, 13, 1.24, 16, 1.44];
  if (!selected) return rest;
  return ["case", ["==", ["get", "id"], selected], hot, rest];
}

export function haloRadiusExpr(boost: number): unknown[] {
  return ["+", ["interpolate", ["linear"], ["zoom"], 11, 14, 16, 28], boost];
}

export function storeIdsKey(ids: string[]): string {
  return [...ids].sort().join("|");
}
