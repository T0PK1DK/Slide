/**
 * Copy for empty HUD numbers. Never "—": say what will appear.
 * Real values replace these once a plan, trip, or week of drives exists.
 */
export const EMPTY = {
  score: "After a plan",
  eta: "After a plan",
  driveTime: "After a trip",
  driven: "After a trip",
  line: "After a trip",
  dest: "Your destination",
  maneuverDist: "Next turn",
  maneuverInstr: "Follow the line",
  remain: "Remaining once GPS locks",
  avgSmooth: "After a drive",
  onTime: "After saved drives",
  weekValue: "After two weeks",
  posted: "No sign",
  expected: "Typical",
} as const;

/** HUD placeholders that must render as `.is-empty`, not hero type. Wording above is unchanged. */
const EMPTY_VALUES = new Set<string>([...Object.values(EMPTY), "Soon"]);

export function isEmptyValue(text: string): boolean {
  return EMPTY_VALUES.has(text);
}

export function setMaybeEmpty(el: HTMLElement, value: string): void {
  el.textContent = value;
  el.classList.toggle("is-empty", isEmptyValue(value));
}

/** Face of the US limit sign. `EMPTY.posted` stays for the speed-rail list, not this box. */
export function postedSignText(mph: number | null | undefined): string {
  return mph ? String(mph) : "--";
}
