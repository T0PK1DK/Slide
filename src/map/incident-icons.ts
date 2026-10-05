import type { RadarKind } from "../lib/reports";

/**
 * Original 24×24 glyphs for map incident pins. Warm-glass, one colour
 * (currentColor), readable at ~28 px while driving. No brand copies.
 */
const PATH: Record<RadarKind, string> = {
  crash: `<path d="M12 3.2 21.2 20H2.8L12 3.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.2v5.2M12 17.4h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  roadwork: `<path d="M4.2 18.8h15.6L12 4.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.2 14.6h5.6M10.4 11.2l3.2 3.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  closure: `<rect x="4" y="7.2" width="16" height="9.6" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 7.2v9.6M16 7.2v9.6" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  hazard: `<path d="M12 3.4 21 19.4H3L12 3.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.4v5M12 17.2h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  police: `<path d="M12 3.2l7.2 3v5.2c0 4.2-2.8 7.4-7.2 9.2-4.4-1.8-7.2-5-7.2-9.2V6.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.2 12.2h5.6M12 9.4v5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  jam: `<path d="M5 8.2h3.4v3.2H5zm5.3 0h3.4v3.2h-3.4zm5.3 0H19v3.2h-3.4M5 13.6h14v2.4H5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  camera: `<rect x="3.4" y="7.2" width="13.2" height="9.6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16.6 10.2 21 8.2v7.6l-4.4-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  bus: `<rect x="5" y="4.4" width="14" height="13.2" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 10.4h14" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  rail: `<rect x="6" y="3.6" width="12" height="13.2" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 20.2 10 16.8M15.8 20.2 14 16.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
};

export function incidentGlyph(kind: RadarKind): string {
  return PATH[kind] ?? PATH.hazard;
}

/** Small glass pin: disc + glyph. Colour comes from the kind class. */
export function incidentPinSvg(kind: RadarKind): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${incidentGlyph(kind)}</svg>`;
}

export const SOURCE_LABEL: Record<RadarItemSource, string> = {
  driver: "Reported by drivers",
  fdot: "FDOT",
  mdpd: "Miami-Dade Police",
  fl511: "FL511",
  tomtom: "TomTom",
  osm: "OpenStreetMap",
  transit: "Transit",
};

export type RadarItemSource = "driver" | "fdot" | "mdpd" | "fl511" | "osm" | "transit" | "tomtom";

export const KIND_LABEL: Record<RadarKind, string> = {
  police: "Police / speed trap",
  crash: "Crash",
  hazard: "Hazard",
  closure: "Road closed",
  jam: "Congestion",
  roadwork: "Construction",
  camera: "Camera",
  bus: "Bus",
  rail: "Train",
};
