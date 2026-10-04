/**
 * XP and levels. Earned from smooth score and smoothly-driven distance only.
 *
 * Curve (deterministic):
 *   xpAtLevel(n) = 40 * (n - 1) * n     for integer n >= 1
 *   level 1 starts at 0, level 2 at 80, 3 at 240, 4 at 480, 5 at 800, …
 *
 * Trip XP:
 *   floor(smoothMiles * 10 + qualityBonus(score))
 *   qualityBonus is a function of score only (never speed or time saved).
 */
import { smoothMiles } from "./smoothScore";

export const XP_PER_SMOOTH_MILE = 10;

export function xpAtLevel(level: number): number {
  const n = Math.floor(level);
  if (!Number.isFinite(n) || n <= 1) return 0;
  return 40 * (n - 1) * n;
}

export function levelForXp(xp: number): number {
  const x = Math.max(0, Math.floor(xp));
  let n = 1;
  while (xpAtLevel(n + 1) <= x) n += 1;
  return n;
}

export function xpToNextLevel(xp: number): { level: number; into: number; need: number } {
  const level = levelForXp(xp);
  const floor = xpAtLevel(level);
  const next = xpAtLevel(level + 1);
  return { level, into: Math.max(0, Math.floor(xp) - floor), need: next - floor };
}

/** Score-only bonus. Higher speed cannot change this. */
export function qualityBonus(score: number): number {
  if (score >= 90) return 20;
  if (score >= 75) return 12;
  if (score >= 60) return 5;
  return 0;
}

/**
 * XP for one trip. `score` is the telemetry smooth score (0–100), not the
 * route Slide score. Null score or no distance → 0. Duration is unused.
 */
export function xpForTrip(distanceMi: number, score: number | null): number {
  if (score == null || score <= 0 || distanceMi <= 0 || !Number.isFinite(distanceMi)) return 0;
  return Math.floor(smoothMiles(distanceMi, score) * XP_PER_SMOOTH_MILE + qualityBonus(score));
}
