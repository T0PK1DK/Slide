export type CameraMode = "cinematic" | "chase" | "top";
export type TrailStyle = "plasma" | "ember" | "ice" | "volt";
export type MapSkin = "cinematic" | "apple" | "waze";

export const MAP_STYLES: Record<MapSkin, string> = {
  cinematic: "https://tiles.openfreemap.org/styles/dark",
  apple: "https://tiles.openfreemap.org/styles/liberty",
  waze: "https://tiles.openfreemap.org/styles/dark",
};

export type SavedPlace = {
  label: string;
  sub: string;
  lon: number;
  lat: number;
};

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
  /** First-run “How to Slide” was dismissed. Help still reopens it. */
  coachDismissed: boolean;
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

const TRAILS_OK = new Set<string>(["plasma", "ember", "ice", "volt"]);
const CAM_OK = new Set<string>(["cinematic", "chase", "top"]);
const SKIN_OK = new Set<string>(["cinematic", "apple", "waze"]);

function asPlace(value: unknown): SavedPlace | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const lon = Number(o.lon);
  const lat = Number(o.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const label = typeof o.label === "string" ? o.label : "";
  const sub =
    typeof o.sub === "string"
      ? o.sub
      : label.includes(",")
        ? label.slice(label.indexOf(",") + 1).trim()
        : "";
  return { label, sub, lon, lat };
}

function asTrail(value: unknown): TrailStyle {
  return TRAILS_OK.has(String(value)) ? (value as TrailStyle) : DEFAULT_GARAGE.trail;
}

function asCamera(value: unknown): CameraMode {
  return CAM_OK.has(String(value)) ? (value as CameraMode) : DEFAULT_GARAGE.camera;
}

function asSkin(value: unknown): MapSkin {
  return SKIN_OK.has(String(value)) ? (value as MapSkin) : DEFAULT_GARAGE.mapSkin;
}

/** Merge older `slide.garage.v1` payloads (missing `sub`, leftover fields) without crashing. */
export function loadGarage(): GarageConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_GARAGE, recents: [] };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const recents = Array.isArray(parsed.recents)
      ? parsed.recents.map(asPlace).filter((p): p is SavedPlace => p !== null)
      : [];
    return {
      tag: typeof parsed.tag === "string" && parsed.tag.trim() ? parsed.tag : DEFAULT_GARAGE.tag,
      carColor: typeof parsed.carColor === "string" ? parsed.carColor : DEFAULT_GARAGE.carColor,
      glow: typeof parsed.glow === "string" ? parsed.glow : DEFAULT_GARAGE.glow,
      trail: asTrail(parsed.trail),
      camera: asCamera(parsed.camera),
      mapSkin: asSkin(parsed.mapSkin),
      showGhosts: parsed.showGhosts !== undefined ? Boolean(parsed.showGhosts) : DEFAULT_GARAGE.showGhosts,
      showBuildings: parsed.showBuildings !== undefined ? Boolean(parsed.showBuildings) : DEFAULT_GARAGE.showBuildings,
      shareGhost: parsed.shareGhost !== undefined ? Boolean(parsed.shareGhost) : DEFAULT_GARAGE.shareGhost,
      coachDismissed: Boolean(parsed.coachDismissed),
      recents,
      home: asPlace(parsed.home),
      work: asPlace(parsed.work),
    };
  } catch {
    return { ...DEFAULT_GARAGE, recents: [] };
  }
}

export function saveGarage(cfg: GarageConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function asSavedPlace(hit: { label: string; lon: number; lat: number }, sub = ""): SavedPlace {
  const inferred = hit.label.includes(",") ? hit.label.slice(hit.label.indexOf(",") + 1).trim() : "";
  return { label: hit.label, sub: sub || inferred, lon: hit.lon, lat: hit.lat };
}
