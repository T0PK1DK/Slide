import { nextMove, type Step } from "../lib/guidance";

/** About half a mile out. */
export const FAR_MI = 0.5;
/** About a tenth of a mile out. */
export const NEAR_MI = 0.1;
/** At the maneuver (~100 ft). */
export const NOW_MI = 0.02;
/**
 * Do not say "half a mile" once closer than this. A GPS jump from 0.8 mi to
 * 400 ft must not speak the far prompt.
 */
export const FAR_FLOOR_MI = 0.25;

export type Threshold = "far" | "near" | "now";

export type ManeuverCue = {
  id: string;
  verbal: string;
  type: number;
  distanceMi: number;
};

/** Valhalla start maneuvers (kNone / kStart / kStartRight / kStartLeft). */
const START_TYPES = new Set([0, 1, 2, 3]);

export function maneuverId(step: Pick<Step, "startMi" | "type" | "instruction">): string {
  return `${step.startMi.toFixed(4)}:${step.type}:${step.instruction}`;
}

/**
 * The step `nextMove` is announcing: step i+1 while travelling i, or the last
 * step (destination) once nothing is left after the current one.
 */
export function upcomingStep(steps: Step[], progressMi: number): Step | null {
  if (!steps.length) return null;
  const i = steps.findIndex((s) => progressMi < s.endMi);
  const currentIdx = i === -1 ? steps.length - 1 : i;
  return steps[currentIdx + 1] ?? steps[steps.length - 1];
}

export function upcomingCue(steps: Step[], progressMi: number): ManeuverCue | null {
  const step = upcomingStep(steps, progressMi);
  const move = nextMove(steps, progressMi);
  if (!step || !move || START_TYPES.has(step.type)) return null;
  const verbal = (step.verbal || step.instruction || "").trim();
  if (!verbal) return null;
  return {
    id: maneuverId(step),
    verbal,
    type: step.type,
    distanceMi: move.distanceMi,
  };
}

/**
 * Nearest applicable unfired threshold. Farther prompts that were skipped
 * (GPS jump, short step) stay unsaid.
 */
export function dueThreshold(distanceMi: number, fired: ReadonlySet<Threshold>): Threshold | null {
  if (distanceMi <= NOW_MI && !fired.has("now")) return "now";
  if (distanceMi <= NEAR_MI && !fired.has("near")) return "near";
  if (distanceMi <= FAR_MI && distanceMi > FAR_FLOOR_MI && !fired.has("far")) return "far";
  return null;
}

/** Spoken form. Distance words only — never a speed suggestion. */
export function voicePhrase(threshold: Threshold, verbal: string): string {
  const text = sanitizeVoice(verbal);
  if (!text) return "";
  if (threshold === "far") return `In a half mile, ${text}`;
  if (threshold === "near") return `In a tenth of a mile, ${text}`;
  return text;
}

export function sanitizeVoice(verbal: string): string {
  return verbal.replace(/\s+/g, " ").trim();
}

/** Remembers which prompts already played for each maneuver. Clear on reroute. */
export class AnnounceTracker {
  private fired = new Map<string, Set<Threshold>>();

  reset(): void {
    this.fired.clear();
  }

  next(id: string, distanceMi: number, verbal: string): string | null {
    let set = this.fired.get(id);
    if (!set) {
      set = new Set();
      this.fired.set(id, set);
    }
    const threshold = dueThreshold(distanceMi, set);
    if (!threshold) return null;
    set.add(threshold);
    const phrase = voicePhrase(threshold, verbal);
    return phrase || null;
  }
}
