import type { RadarKind } from "../lib/reports";

/**
 * Original Slide incident glyphs — simple night-HUD marks, not copies of
 * Waze / Google / Apple. Construction uses the roadwork kind.
 */
const PATH: Record<string, string> = {
  crash: `<path d="M4.5 14.5l4-7 3.2 4.2 3.6-6.2 4.2 9.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.2" cy="16.2" r="1.5"/><circle cx="16.2" cy="16.2" r="1.5"/>`,
  closure: `<path d="M5 7.5h14M5 16.5h14M8 7.5v9M16 7.5v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 11.5h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  roadwork: `<path d="M8 17.5V10l4-5 4 5v7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 13.5h8M10.2 17.5h3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="11.2" r="1.1"/>`,
  hazard: `<path d="M12 3.6l8.4 15.2H3.6L12 3.6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 9.2v5.2M12 16.8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  jam: `<path d="M4.5 8.2h5.2v3.4H4.5zm5.1 0h5.2v3.4h-5.2zm5.1 0H20v3.4h-5.3M4.5 13.4H20v2.4H4.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  police: `<path d="M12 3.4l7.2 3.1v4.6c0 4.4-3.1 7.7-7.2 9.5-4.1-1.8-7.2-5.1-7.2-9.5V6.5L12 3.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 8.2v6.2M9.2 11.3h5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
};

const CLASS: Partial<Record<RadarKind, string>> = {
  crash: "crash",
  closure: "closure",
  roadwork: "construction",
  hazard: "hazard",
  jam: "jam",
  police: "police",
};

export function incidentIconSvg(kind: RadarKind): string {
  const glyph = PATH[kind] ?? PATH.hazard;
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${glyph}</svg>`;
}

export function incidentMarkerHtml(kind: RadarKind): string {
  const cls = CLASS[kind] ?? "hazard";
  return `<span class="inc-mark ${cls}">${incidentIconSvg(kind)}</span>`;
}
