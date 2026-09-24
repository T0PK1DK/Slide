export type CameraMode = "cinematic" | "chase" | "top";
export type TrailStyle = "plasma" | "ember" | "ice" | "volt";
export type MapSkin = "cinematic" | "apple" | "slide";

export const MAP_STYLES: Record<MapSkin, string> = {
  cinematic: "https://tiles.openfreemap.org/styles/dark",
  apple: "https://tiles.openfreemap.org/styles/liberty",
  slide: "https://tiles.openfreemap.org/styles/dark",
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
};

export function loadGarage(): GarageConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_GARAGE };
    const saved = JSON.parse(raw) as Omit<Partial<GarageConfig>, "mapSkin"> & { mapSkin?: string };
    // The flat night skin was once called "waze"; it's Slide's own look now.
    if (saved.mapSkin === "waze") saved.mapSkin = "slide";
    if (saved.mapSkin && !(saved.mapSkin in MAP_STYLES)) delete saved.mapSkin;
    return { ...DEFAULT_GARAGE, ...(saved as Partial<GarageConfig>) };
  } catch {
    return { ...DEFAULT_GARAGE };
  }
}

export function saveGarage(cfg: GarageConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}
