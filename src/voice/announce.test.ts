import { describe, expect, it } from "vitest";
import { buildSteps } from "../lib/guidance";
import type { Maneuver } from "../lib/valhalla";
import {
  AnnounceTracker,
  dueThreshold,
  FAR_FLOOR_MI,
  FAR_MI,
  maneuverId,
  NEAR_MI,
  NOW_MI,
  upcomingCue,
  voicePhrase,
  type Threshold,
} from "./announce";

function fired(...t: Threshold[]): Set<Threshold> {
  return new Set(t);
}

describe("dueThreshold", () => {
  it("stays quiet until about half a mile", () => {
    expect(dueThreshold(0.8, fired())).toBeNull();
    expect(dueThreshold(FAR_MI + 0.01, fired())).toBeNull();
  });

  it("fires far at about 0.5 mi, then waits for 0.1", () => {
    expect(dueThreshold(FAR_MI, fired())).toBe("far");
    expect(dueThreshold(0.4, fired())).toBe("far");
    expect(dueThreshold(0.4, fired("far"))).toBeNull();
  });

  it("fires near at about 0.1 mi, then waits for the turn", () => {
    expect(dueThreshold(NEAR_MI, fired("far"))).toBe("near");
    expect(dueThreshold(0.06, fired("far", "near"))).toBeNull();
  });

  it("fires now at the turn", () => {
    expect(dueThreshold(NOW_MI, fired("far", "near"))).toBe("now");
    expect(dueThreshold(0, fired("far", "near"))).toBe("now");
    expect(dueThreshold(0, fired("far", "near", "now"))).toBeNull();
  });

  it("on a GPS jump, speaks only the nearest missed threshold", () => {
    expect(dueThreshold(0.08, fired())).toBe("near");
    expect(dueThreshold(0.01, fired())).toBe("now");
    expect(dueThreshold(0.2, fired())).toBeNull();
    expect(0.2).toBeLessThan(FAR_FLOOR_MI);
  });
});

describe("AnnounceTracker once-per-maneuver", () => {
  const left = "Turn left onto Brickell Avenue.";
  const right = "Turn right onto 8th Street.";

  it("each threshold fires once for the same maneuver", () => {
    const t = new AnnounceTracker();
    expect(t.next("a", 0.5, left)).toBe("In a half mile, Turn left onto Brickell Avenue.");
    expect(t.next("a", 0.45, left)).toBeNull();
    expect(t.next("a", 0.1, left)).toBe("In a tenth of a mile, Turn left onto Brickell Avenue.");
    expect(t.next("a", 0.09, left)).toBeNull();
    expect(t.next("a", 0.01, left)).toBe(left);
    expect(t.next("a", 0, left)).toBeNull();
  });

  it("a new maneuver has its own thresholds", () => {
    const t = new AnnounceTracker();
    expect(t.next("left", 0.5, left)).toMatch(/half mile/);
    expect(t.next("right", 0.5, right)).toMatch(/half mile/);
    expect(t.next("left", 0.5, left)).toBeNull();
  });

  it("reset on reroute lets the new line speak again", () => {
    const t = new AnnounceTracker();
    t.next("a", 0.5, left);
    t.reset();
    expect(t.next("a", 0.5, left)).toMatch(/half mile/);
  });

  it("never writes a speed suggestion into the phrase", () => {
    const phrase = voicePhrase("far", "Keep right to stay on I-95 North.");
    expect(phrase.toLowerCase()).not.toMatch(/speed up|go faster|faster than|beat the/);
    expect(voicePhrase("now", "Turn left.")).toBe("Turn left.");
  });
});

describe("upcomingCue from real step geometry", () => {
  const maneuvers: Maneuver[] = [
    { type: 1, instruction: "Start", time: 0, length: 0.6, begin_shape_index: 0, end_shape_index: 4, verbal_pre_transition_instruction: "Drive north." },
    { type: 15, instruction: "Turn left onto Brickell Avenue.", time: 20, length: 0.4, begin_shape_index: 4, end_shape_index: 10, verbal_pre_transition_instruction: "Turn left onto Brickell Avenue." },
    { type: 4, instruction: "You have arrived at your destination.", time: 10, length: 0, begin_shape_index: 10, end_shape_index: 10, verbal_pre_transition_instruction: "You have arrived at your destination." },
  ];
  const steps = buildSteps(maneuvers);

  it("announces step i+1, not the start maneuver", () => {
    const cue = upcomingCue(steps, 0.2);
    expect(cue?.verbal).toBe("Turn left onto Brickell Avenue.");
    expect(cue?.distanceMi).toBeCloseTo(0.4, 5);
    expect(cue?.id).toBe(maneuverId(steps[1]));
  });

  it("does not invent a cue off an empty line", () => {
    expect(upcomingCue([], 0)).toBeNull();
  });
});
