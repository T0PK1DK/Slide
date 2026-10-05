import { haversineMeters } from "./polyline";
import type { RadarItem } from "./reports";

const NEAR_M = 180;
const OFFICIAL = new Set(["fdot", "mdpd", "fl511"]);

/** Same kind within ~180 m — treat as one event. */
export function sameIncident(a: RadarItem, b: RadarItem): boolean {
  if (a.kind !== b.kind) return false;
  return haversineMeters(a.lon, a.lat, b.lon, b.lat) < NEAR_M;
}

function delaySnippet(detail: string): string | null {
  const m = detail.match(/\+\d+\s*min/);
  return m ? m[0] : null;
}

/**
 * Keep FDOT / Miami-Dade / FL511 when they already cover a TomTom pin.
 * Fold TomTom delay into the official detail when it adds a real +N min.
 */
export function foldTomTomIntoOfficial(official: RadarItem[], tomtom: RadarItem[]): RadarItem[] {
  const used = new Set<string>();
  const out = official.map((item) => ({ ...item }));
  for (const t of tomtom) {
    const twin = out.find((o) => OFFICIAL.has(o.source) && sameIncident(o, t));
    if (!twin) continue;
    used.add(t.id);
    const extra = delaySnippet(t.detail);
    if (extra && !twin.detail.includes(extra)) {
      twin.detail = `${twin.detail} · TomTom ${extra}`;
    }
  }
  for (const t of tomtom) {
    if (!used.has(t.id)) out.push(t);
  }
  return out;
}
