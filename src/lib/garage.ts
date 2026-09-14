export type CameraMode = "cinematic" | "chase" | "top";
export type TrailStyle = "plasma" | "ember" | "ice" | "volt";

export type GarageConfig = {
  tag: string;
  carColor: string;
  glow: string;
  trail: TrailStyle;
  camera: CameraMode;
  showGhosts: boolean;
  showBuildings: boolean;
  shareGhost: boolean;
  /** First-run “How to Slide” was dismissed. Help still reopens it. */
  coachDismissed: boolean;
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
  glow: "#78e0c8",
  trail: "plasma",
  camera: "cinematic",
  showGhosts: true,
  showBuildings: true,
  shareGhost: true,
  coachDismissed: false,
};

export function loadGarage(): GarageConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_GARAGE };
    return { ...DEFAULT_GARAGE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GARAGE };
  }
}

export function saveGarage(cfg: GarageConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}
