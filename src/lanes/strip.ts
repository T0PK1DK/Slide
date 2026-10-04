import type { ManeuverLane } from "../lib/valhalla";

/** Show the strip once the upcoming maneuver is about this close. */
export const LANE_APPROACH_MI = 0.75;

export type LaneDir =
  | "through"
  | "left"
  | "right"
  | "slightLeft"
  | "slightRight"
  | "sharpLeft"
  | "sharpRight"
  | "reverse"
  | "mergeToLeft"
  | "mergeToRight";

export type LaneView = { dirs: LaneDir[]; valid: boolean; active: boolean };

const BITS: ReadonlyArray<readonly [number, LaneDir]> = [
  [2, "through"],
  [4, "sharpLeft"],
  [8, "left"],
  [16, "slightLeft"],
  [32, "slightRight"],
  [64, "right"],
  [128, "sharpRight"],
  [256, "reverse"],
  [512, "mergeToLeft"],
  [1024, "mergeToRight"],
];

const ARROW: Record<LaneDir, string> = {
  through: "↑",
  left: "←",
  right: "→",
  slightLeft: "↖",
  slightRight: "↗",
  sharpLeft: "↰",
  sharpRight: "↱",
  reverse: "↩",
  mergeToLeft: "//",
  mergeToRight: "\\",
};

const INDICATION: Record<string, LaneDir> = {
  through: "through",
  straight: "through",
  none: "through",
  left: "left",
  right: "right",
  "slight left": "slightLeft",
  slightleft: "slightLeft",
  "slight right": "slightRight",
  slightright: "slightRight",
  "sharp left": "sharpLeft",
  sharpleft: "sharpLeft",
  "sharp right": "sharpRight",
  sharpright: "sharpRight",
  reverse: "reverse",
  uturn: "reverse",
  "u-turn": "reverse",
  "merge to left": "mergeToLeft",
  mergetoleft: "mergeToLeft",
  "merge to right": "mergeToRight",
  mergetoright: "mergeToRight",
};

export function dirsFromMask(mask: number): LaneDir[] {
  if (!Number.isFinite(mask) || mask <= 0) return [];
  return BITS.filter(([bit]) => (mask & bit) !== 0).map(([, dir]) => dir);
}

function flagOn(v: unknown): boolean {
  if (typeof v === "number") return v !== 0;
  return v === true;
}

/** Pure: Valhalla lane objects → something a strip can draw. Empty if none are usable. */
export function normalizeLanes(raw: readonly ManeuverLane[] | null | undefined): LaneView[] {
  if (!raw?.length) return [];
  const out: LaneView[] = [];
  for (const lane of raw) {
    if (!lane || typeof lane !== "object") continue;
    let dirs = typeof lane.directions === "number" ? dirsFromMask(lane.directions) : [];
    if (!dirs.length && Array.isArray(lane.indications)) {
      for (const rawDir of lane.indications) {
        const key = String(rawDir).trim().toLowerCase();
        const dir = INDICATION[key];
        if (dir && !dirs.includes(dir)) dirs.push(dir);
      }
    }
    const active = flagOn(lane.active);
    const valid = flagOn(lane.valid) || active;
    if (!dirs.length) continue;
    out.push({ dirs, valid, active });
  }
  return out;
}

/** "Use the right two lanes" — only names lanes that are active (or valid if none are). */
export function laneUseLabel(lanes: readonly LaneView[]): string {
  if (!lanes.length) return "";
  const pick = lanes.some((l) => l.active) ? lanes.map((l) => l.active) : lanes.map((l) => l.valid);
  const idxs = pick.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  if (!idxs.length) return "Lane guidance";
  if (idxs.length === lanes.length) return lanes.length === 1 ? "Use the lane" : `Use all ${lanes.length} lanes`;
  const first = idxs[0];
  const last = idxs[idxs.length - 1];
  const contiguous = idxs.every((n, i) => i === 0 || n === idxs[i - 1] + 1);
  if (contiguous && last === lanes.length - 1) {
    return idxs.length === 1 ? "Use the right lane" : `Use the right ${idxs.length} lanes`;
  }
  if (contiguous && first === 0) {
    return idxs.length === 1 ? "Use the left lane" : `Use the left ${idxs.length} lanes`;
  }
  return idxs.length === 1 ? "Use the highlighted lane" : `Use ${idxs.length} highlighted lanes`;
}

export function laneStripHtml(lanes: readonly LaneView[]): string {
  const items = lanes
    .map((lane) => {
      const arrows = lane.dirs
        .map((d) => `<span data-dir="${d}" aria-hidden="true">${ARROW[d]}</span>`)
        .join("");
      return `<li data-valid="${lane.valid ? "true" : "false"}" data-active="${lane.active ? "true" : "false"}">${arrows}</li>`;
    })
    .join("");
  return `<ol>${items}</ol>`;
}

let host: HTMLElement | null = null;

/** Attach to Grim's `#lane-strip`. The slot stays hidden until there is real data. */
export function mountLaneStrip(el: HTMLElement): void {
  host = el;
  el.hidden = true;
  el.replaceChildren();
}

/**
 * Draw the upcoming maneuver's lanes into Grim's slot, or hide it when there
 * are none (or the turn is still too far away).
 */
export function renderLaneStrip(
  lanes: readonly ManeuverLane[] | null | undefined,
  distanceMi = 0
): void {
  if (!host) return;
  const views = distanceMi <= LANE_APPROACH_MI ? normalizeLanes(lanes) : [];
  if (!views.length) {
    host.hidden = true;
    host.replaceChildren();
    host.setAttribute("aria-label", "Lane guidance");
    return;
  }
  host.hidden = false;
  host.setAttribute("aria-label", laneUseLabel(views));
  host.innerHTML = laneStripHtml(views);
}
