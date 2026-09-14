import type { Maneuver } from "./valhalla";
import type { SpeedBand } from "./smooth";

/** One maneuver placed on the route by cumulative distance from the start. */
export type Step = {
  instruction: string;
  verbal: string;
  type: number;
  startMi: number;
  endMi: number;
  street: string;
};

export type NextMove = {
  instruction: string;
  distanceMi: number;
  type: number;
  then: string | null;
  /** 0..1 — how close the maneuver is, for the approach bar. */
  proximity: number;
};

export type PostedOutlook = {
  name: string;
  currentMph: number | null;
  nextMph: number | null;
  changeInMi: number | null;
  /** True when the limit is about to drop, which is what a driver must act on. */
  dropping: boolean;
};

export function buildSteps(maneuvers: Maneuver[], toMiles = 1): Step[] {
  const steps: Step[] = [];
  let cursor = 0;
  for (const m of maneuvers) {
    const len = (m.length || 0) * toMiles;
    steps.push({
      instruction: m.instruction || "Continue",
      verbal: m.verbal_pre_transition_instruction || m.instruction || "Continue",
      type: m.type,
      startMi: cursor,
      endMi: cursor + len,
      street: (m.street_names && m.street_names[0]) || "",
    });
    cursor += len;
  }
  return steps;
}

/**
 * The move the driver is currently approaching. A maneuver's instruction
 * describes what happens at its *start*, so the thing to announce while
 * travelling through step i is step i+1.
 */
export function nextMove(steps: Step[], progressMi: number): NextMove | null {
  if (!steps.length) return null;
  const i = steps.findIndex((s) => progressMi < s.endMi);
  const currentIdx = i === -1 ? steps.length - 1 : i;
  const upcoming = steps[currentIdx + 1];
  if (!upcoming) {
    const last = steps[steps.length - 1];
    return {
      instruction: last.instruction,
      distanceMi: Math.max(0, last.endMi - progressMi),
      type: last.type,
      then: null,
      proximity: 1,
    };
  }
  const current = steps[currentIdx];
  const distance = Math.max(0, upcoming.startMi - progressMi);
  const span = Math.max(current.endMi - current.startMi, 0.02);
  return {
    instruction: upcoming.instruction,
    distanceMi: distance,
    type: upcoming.type,
    then: steps[currentIdx + 2]?.instruction ?? null,
    proximity: Math.max(0, Math.min(1, 1 - distance / span)),
  };
}

/**
 * "Hold 45 -> 30 in 0.4 mi". Posted is the sign, never a suggestion to exceed it.
 */
export function postedOutlook(bands: SpeedBand[], progressMi: number): PostedOutlook | null {
  if (!bands.length) return null;
  const i = bands.findIndex((b) => progressMi < b.toMi);
  const idx = i === -1 ? bands.length - 1 : i;
  const band = bands[idx];
  const next = bands.slice(idx + 1).find((b) => b.postedMph !== band.postedMph && b.postedMph !== null);
  return {
    name: band.name,
    currentMph: band.postedMph,
    nextMph: next?.postedMph ?? null,
    changeInMi: next ? Math.max(0, next.fromMi - progressMi) : null,
    dropping: Boolean(next && band.postedMph && next.postedMph! < band.postedMph),
  };
}

/** Feet under a tenth of a mile, matching how road signage reads. */
export function formatShortDistance(mi: number): string {
  if (mi < 0.095) {
    const ft = Math.round((mi * 5280) / 50) * 50;
    return `${Math.max(ft, 50)} ft`;
  }
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

const ARROWS: Record<string, string> = {
  straight: "M12 22V4M5 11l7-7 7 7",
  right: "M5 22v-8a4 4 0 014-4h8M12 5l6 5-6 5",
  left: "M19 22v-8a4 4 0 00-4-4H7M12 5l-6 5 6 5",
  slightRight: "M7 22v-6a6 6 0 016-6h4M13 4l5 3-3 5",
  slightLeft: "M17 22v-6a6 6 0 00-6-6H7M11 4L6 7l3 5",
  sharpRight: "M6 22v-6a6 6 0 016-6h5M12 4l6 6-6 6",
  sharpLeft: "M18 22v-6a6 6 0 00-6-6H7M12 4l-6 6 6 6",
  uturn: "M7 22V11a5 5 0 0110 0v4M4 18l3 4 3-4",
  merge: "M12 22v-7c0-4 3-6 7-7M12 15c0-4-3-6-7-7",
  roundabout: "M12 22v-6M12 6a4 4 0 110 8 4 4 0 010-8M16 8l4-3",
  destination: "M6 22V4l12 4-12 4",
};

/** Maps a Valhalla maneuver type to an arrow path. Keep in sync with smooth.ts. */
export function maneuverArrow(type: number): string {
  if (type === 9) return ARROWS.slightRight;
  if (type === 10) return ARROWS.right;
  if (type === 11) return ARROWS.sharpRight;
  if (type === 12 || type === 13) return ARROWS.uturn;
  if (type === 14) return ARROWS.sharpLeft;
  if (type === 15) return ARROWS.left;
  if (type === 16) return ARROWS.slightLeft;
  if (type === 18 || type === 20 || type === 23) return ARROWS.slightRight;
  if (type === 19 || type === 21 || type === 24) return ARROWS.slightLeft;
  if (type === 25) return ARROWS.merge;
  if (type === 26 || type === 27) return ARROWS.roundabout;
  if (type >= 4 && type <= 6) return ARROWS.destination;
  return ARROWS.straight;
}
