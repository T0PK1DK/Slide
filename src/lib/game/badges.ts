/**
 * Tiered badges. Bronze / silver / gold. No licensed brands.
 * A badge only advances when the trip supplies the real signal it needs.
 */
import type { SmoothScore } from "./smoothScore";

export type BadgeTier = "bronze" | "silver" | "gold";
export type BadgeId =
  | "first-line"
  | "smooth-streak"
  | "gentle-brake"
  | "night-owl"
  | "smooth-miles"
  | "limit-keeper"
  | "causeway";

export type BadgeDef = {
  id: BadgeId;
  name: string;
  blurb: string;
  thresholds: Record<BadgeTier, number>;
};

export const BADGE_DEFS: readonly BadgeDef[] = [
  { id: "first-line", name: "First Line", blurb: "Finish scored drives.", thresholds: { bronze: 1, silver: 3, gold: 10 } },
  { id: "smooth-streak", name: "Glass Line", blurb: "Consecutive drives scoring 75 or more.", thresholds: { bronze: 3, silver: 7, gold: 21 } },
  { id: "gentle-brake", name: "Soft Pedal", blurb: "Trips with no harsh braking.", thresholds: { bronze: 1, silver: 10, gold: 25 } },
  { id: "night-owl", name: "Night Owl", blurb: "Smooth night drives (8pm–5am).", thresholds: { bronze: 1, silver: 5, gold: 15 } },
  { id: "smooth-miles", name: "Long Slide", blurb: "Miles driven smoothly.", thresholds: { bronze: 10, silver: 50, gold: 100 } },
  { id: "limit-keeper", name: "Sign Reader", blurb: "Trips that stayed at or under the posted limit.", thresholds: { bronze: 1, silver: 10, gold: 25 } },
  { id: "causeway", name: "Causeway", blurb: "Drives that actually crossed a Miami causeway.", thresholds: { bronze: 1, silver: 5, gold: 15 } },
];

export const BADGE_BY_ID: Record<BadgeId, BadgeDef> = Object.fromEntries(
  BADGE_DEFS.map((b) => [b.id, b])
) as Record<BadgeId, BadgeDef>;

export const TIER_ORDER: readonly BadgeTier[] = ["bronze", "silver", "gold"];

export function tierForCount(count: number, thresholds: Record<BadgeTier, number>): BadgeTier | null {
  if (count >= thresholds.gold) return "gold";
  if (count >= thresholds.silver) return "silver";
  if (count >= thresholds.bronze) return "bronze";
  return null;
}

export function isNightDrive(startedAt: number): boolean {
  const h = new Date(startedAt).getHours();
  return h >= 20 || h < 5;
}

/** Real public midpoints. A sample must land within this radius to count. */
export const CAUSEWAYS: readonly { name: string; lon: number; lat: number; radiusM: number }[] = [
  { name: "MacArthur", lon: -80.17, lat: 25.7906, radiusM: 450 },
  { name: "Rickenbacker", lon: -80.17, lat: 25.745, radiusM: 450 },
];

export type TripSignals = {
  score: SmoothScore;
  distanceMi: number;
  startedAt: number;
  /** True when at least one sample has real lon/lat. */
  hasCoords: boolean;
  crossedCauseway: boolean;
};

export type BadgeCounts = Record<BadgeId, number>;

export function emptyBadgeCounts(): BadgeCounts {
  return {
    "first-line": 0,
    "smooth-streak": 0,
    "gentle-brake": 0,
    "night-owl": 0,
    "smooth-miles": 0,
    "limit-keeper": 0,
    causeway: 0,
  };
}

export const SMOOTH_STREAK_MIN = 75;
export const NIGHT_SMOOTH_MIN = 70;

/**
 * How this trip moves each counter. A factor that was not measured does not
 * increment the badge that needs it (no faking).
 */
export function tripBadgeDeltas(prevStreak: number, trip: TripSignals): Partial<BadgeCounts> {
  const { score } = trip;
  const deltas: Partial<BadgeCounts> = {};
  if (score.total == null) return deltas;

  deltas["first-line"] = 1;

  if (score.total >= SMOOTH_STREAK_MIN) deltas["smooth-streak"] = prevStreak + 1;
  else deltas["smooth-streak"] = 0;

  if (score.factors.pace != null && !score.harshBrake) deltas["gentle-brake"] = 1;

  if (isNightDrive(trip.startedAt) && score.total >= NIGHT_SMOOTH_MIN) deltas["night-owl"] = 1;

  deltas["smooth-miles"] = trip.distanceMi * (score.total / 100);

  // Only when a posted limit was actually present on the trip.
  if (score.factors.limit != null && score.overLimitSec === 0) deltas["limit-keeper"] = 1;

  if (trip.hasCoords && trip.crossedCauseway) deltas.causeway = 1;

  return deltas;
}

export function applyBadgeDeltas(counts: BadgeCounts, deltas: Partial<BadgeCounts>): BadgeCounts {
  const next = { ...counts };
  for (const id of Object.keys(deltas) as BadgeId[]) {
    const d = deltas[id];
    if (d == null) continue;
    if (id === "smooth-streak") next[id] = d;
    else next[id] = counts[id] + d;
  }
  return next;
}

export function badgesFromCounts(counts: BadgeCounts): Partial<Record<BadgeId, BadgeTier>> {
  const out: Partial<Record<BadgeId, BadgeTier>> = {};
  for (const def of BADGE_DEFS) {
    const tier = tierForCount(counts[def.id], def.thresholds);
    if (tier) out[def.id] = tier;
  }
  return out;
}

export function newlyEarned(
  before: Partial<Record<BadgeId, BadgeTier>>,
  after: Partial<Record<BadgeId, BadgeTier>>
): Array<{ id: BadgeId; name: string; tier: BadgeTier }> {
  const earned: Array<{ id: BadgeId; name: string; tier: BadgeTier }> = [];
  for (const def of BADGE_DEFS) {
    const a = after[def.id];
    if (!a) continue;
    const b = before[def.id];
    if (b !== a) earned.push({ id: def.id, name: def.name, tier: a });
  }
  return earned;
}
