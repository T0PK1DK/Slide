export type CameraMode = "cinematic" | "chase" | "top";
export type TrailStyle = "plasma" | "ember" | "ice" | "volt";
export type MapSkin = "cinematic" | "apple" | "slide";

export const MAP_STYLES: Record<MapSkin, string> = {
  cinematic: "https://tiles.openfreemap.org/styles/dark",
  apple: "https://tiles.openfreemap.org/styles/liberty",
  slide: "https://tiles.openfreemap.org/styles/dark",
};

/** A saved destination (Home, Work, a recent search). Stays on this device. */
export type SavedPlace = { label: string; lon: number; lat: number };

export type GarageConfig = {
  tag: string;
  carColor: string;
  glow: string;
  trail: TrailStyle;
  camera: CameraMode;
  mapSkin: MapSkin;
  showGhosts: boolean;
  showBuildings: boolean;
  shareGhost: boolean;
  /** First-run "How to Slide" card was dismissed. */
  coachDismissed: boolean;
  /** Last few destinations, newest first. */
  recents: SavedPlace[];
  home: SavedPlace | null;
  work: SavedPlace | null;
};

const KEY = "slide.garage.v1";

export const TRAILS: Record<TrailStyle, { line: string; ghost: string }> = {
  plasma: { line: "#7cf0d8", ghost: "#b388ff" },
  ember: { line: "#ff8a4c", ghost: "#ffd36a" },
  ice: { line: "#8fd3ff", ghost: "#e8f6ff" },
  volt: { line: "#d6ff3c", ghost: "#7cffb2" },
};

export const DEFAULT_GARAGE: GarageConfig = {
  tag: "SLIDE-01",
  carColor: "#e8eef2",
  glow: "#f0a04b",
  trail: "plasma",
  camera: "cinematic",
  mapSkin: "cinematic",
  showGhosts: true,
  showBuildings: true,
  shareGhost: true,
  coachDismissed: false,
  recents: [],
  home: null,
  work: null,
};

const CAMERAS: readonly CameraMode[] = ["cinematic", "chase", "top"];
const HEX = /^#[0-9a-f]{3,8}$/i;
const MAX_RECENTS = 4;

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A saved place survives only if it has a label and a real coordinate. */
export function toPlace(v: unknown): SavedPlace | null {
  if (!isRecord(v)) return null;
  const lon = Number(v.lon);
  const lat = Number(v.lat);
  const label = typeof v.label === "string" ? v.label.trim() : "";
  if (!label || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return { label: label.slice(0, 160), lon, lat };
}

/**
 * Merge whatever is stored under `slide.garage.v1` onto the defaults, one field
 * at a time. Older builds saved fewer fields (no places, no coach flag), some
 * saved extra ones, and a hand-edited or truncated value must not wipe the
 * rest — every valid field is kept, every broken one falls back to its default.
 */
export function migrateGarage(saved: unknown): GarageConfig {
  const out: GarageConfig = { ...DEFAULT_GARAGE, recents: [] };
  if (!isRecord(saved)) return out;
  if (typeof saved.tag === "string" && saved.tag.trim()) out.tag = saved.tag.trim().slice(0, 12);
  if (typeof saved.carColor === "string" && HEX.test(saved.carColor)) out.carColor = saved.carColor;
  if (typeof saved.glow === "string" && HEX.test(saved.glow)) out.glow = saved.glow;
  if (typeof saved.trail === "string" && saved.trail in TRAILS) out.trail = saved.trail as TrailStyle;
  if (typeof saved.camera === "string" && (CAMERAS as readonly string[]).includes(saved.camera)) out.camera = saved.camera as CameraMode;
  // The flat night skin was once called "waze"; it's Slide's own look now.
  const skin = saved.mapSkin === "waze" ? "slide" : saved.mapSkin;
  if (typeof skin === "string" && skin in MAP_STYLES) out.mapSkin = skin as MapSkin;
  for (const k of ["showGhosts", "showBuildings", "shareGhost", "coachDismissed"] as const) {
    if (typeof saved[k] === "boolean") out[k] = saved[k] as boolean;
  }
  if (Array.isArray(saved.recents)) {
    const seen = new Set<string>();
    for (const r of saved.recents) {
      const p = toPlace(r);
      if (!p || seen.has(p.label)) continue;
      seen.add(p.label);
      out.recents.push(p);
      if (out.recents.length >= MAX_RECENTS) break;
    }
  }
  out.home = toPlace(saved.home);
  out.work = toPlace(saved.work);
  return out;
}

export function loadGarage(): GarageConfig {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return migrateGarage(null);
  }
  if (!raw) return migrateGarage(null);
  // One-time copy of the pre-migration value, so a field this build doesn't
  // understand yet is never lost for good.
  try { if (!localStorage.getItem(`${KEY}.backup`)) localStorage.setItem(`${KEY}.backup`, raw); } catch { /* storage full */ }
  try {
    return migrateGarage(JSON.parse(raw));
  } catch {
    // Unreadable JSON: keep a copy so nothing is silently lost, then start clean.
    try { localStorage.setItem(`${KEY}.corrupt`, raw); } catch { /* storage full */ }
    return migrateGarage(null);
  }
}

export function saveGarage(cfg: GarageConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    // Private mode or full storage: the garage still works for this session.
  }
}
