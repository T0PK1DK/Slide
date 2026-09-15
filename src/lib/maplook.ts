import type { Map as MapLibreMap, PaddingOptions } from "maplibre-gl";

/** Night palette tuned toward a readable phone map (blue water, green parks, gold roads). */
const LAND = "#1a2738";
const WATER = "#1a4e8a";
const ROAD = "#c4b56a";
const ROAD_CASE = "#5c5530";
const MOTORWAY = "#d7c05a";
const MINOR = "#8f8350";
const PARK = "#18563a";
const BUILDING = "#2a3a4e";
const LABEL = "#e6eef6";
const HALO = "#121820";

function paint(map: MapLibreMap, id: string, prop: string, value: unknown): void {
  if (!map.getLayer(id)) return;
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    // Style variants omit layers; fail soft.
  }
}

/** Lift OpenFreeMap dark so land, water, and roads separate on iPhone. */
export function liftNightBasemap(map: MapLibreMap): void {
  paint(map, "background", "background-color", LAND);
  paint(map, "water", "fill-color", WATER);
  paint(map, "waterway", "line-color", WATER);
  paint(map, "landcover_ice_shelf", "fill-color", LAND);
  paint(map, "landcover_glacier", "fill-color", "#243044");
  paint(map, "landuse_residential", "fill-color", "#203044");
  paint(map, "landcover_wood", "fill-color", PARK);
  paint(map, "landuse_park", "fill-color", PARK);
  paint(map, "building", "fill-color", BUILDING);
  paint(map, "building", "fill-outline-color", "#3d536c");
  paint(map, "highway_path", "line-color", "#6d6240");
  paint(map, "highway_path", "line-width", ["interpolate", ["linear"], ["zoom"], 13, 0.4, 16, 0.9]);
  paint(map, "highway_minor", "line-color", MINOR);
  paint(map, "highway_minor", "line-width", ["interpolate", ["linear"], ["zoom"], 12, 0.5, 15, 1.2, 18, 2.4]);
  paint(map, "highway_major_casing", "line-color", ROAD_CASE);
  paint(map, "highway_major_casing", "line-width", ["interpolate", ["linear"], ["zoom"], 10, 1.6, 15, 3.2, 18, 6]);
  paint(map, "highway_major_inner", "line-color", ROAD);
  paint(map, "highway_major_inner", "line-width", ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 2.2, 18, 4.5]);
  paint(map, "highway_major_subtle", "line-color", ROAD);
  paint(map, "highway_motorway_casing", "line-color", ROAD_CASE);
  paint(map, "highway_motorway_casing", "line-width", ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 3.2, 16, 5.4]);
  paint(map, "highway_motorway_inner", "line-color", MOTORWAY);
  paint(map, "highway_motorway_inner", "line-width", ["interpolate", ["linear"], ["zoom"], 8, 1.2, 12, 2.2, 16, 4]);
  paint(map, "highway_motorway_subtle", "line-color", MOTORWAY);
  paint(map, "aeroway-taxiway", "line-color", ROAD);
  paint(map, "aeroway-runway-casing", "line-color", ROAD_CASE);
  paint(map, "aeroway-runway", "line-color", ROAD);
  paint(map, "aeroway-area", "fill-color", "#243044");
  paint(map, "road_area_pier", "fill-color", LAND);
  paint(map, "road_pier", "line-color", ROAD);

  for (const id of [
    "highway_name_other",
    "highway_name_motorway",
    "place_other",
    "place_suburb",
    "place_village",
    "place_town",
    "place_city",
    "place_city_large",
    "place_state",
    "water_name",
  ]) {
    paint(map, id, "text-color", LABEL);
    paint(map, id, "text-halo-color", HALO);
    paint(map, id, "text-halo-width", 1.2);
  }

  try {
    map.setLight({ anchor: "viewport", color: "#c5d4e6", intensity: 0.42 });
  } catch {
    // Older styles without a light block.
  }
}

export const BUILDING_PAINT = {
  "fill-extrusion-color": [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "render_height"], ["get", "height"], 12],
    0,
    "#2a3d52",
    40,
    "#35506a",
    120,
    "#41617f",
  ],
  "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 14],
  "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
  "fill-extrusion-opacity": 0.82,
};

function zoomWidth(lo: number, hi: number) {
  return ["interpolate", ["linear"], ["zoom"], 11, lo, 16, hi];
}

type Expr = unknown;

/** Selected ribbon: dark case + mint body + white core, wide enough on a 390px phone. */
export function routeLayerPaints(selectedColor: string): {
  glow: Record<string, Expr>;
  case: Record<string, Expr>;
  line: Record<string, Expr>;
  core: Record<string, Expr>;
} {
  const on = ["==", ["get", "selected"], true];
  return {
    glow: {
      "line-color": selectedColor,
      "line-width": ["case", on, zoomWidth(16, 28), zoomWidth(8, 14)],
      "line-opacity": ["case", on, 0.42, 0.12],
      "line-blur": 2,
    },
    case: {
      "line-color": ["case", on, "#031018", "#1a2430"],
      "line-width": ["case", on, zoomWidth(12, 18), zoomWidth(6, 10)],
      "line-opacity": 0.95,
    },
    line: {
      "line-color": ["case", on, selectedColor, "#7d8d9c"],
      "line-width": ["case", on, zoomWidth(7, 11), zoomWidth(3, 5)],
      "line-opacity": ["case", on, 1, 0.55],
    },
    core: {
      "line-color": "#f4fffb",
      "line-width": ["case", on, zoomWidth(2, 3.4), 0],
      "line-opacity": ["case", on, 0.92, 0],
    },
  };
}

export const LINE_LAYOUT = {
  "line-cap": "round" as const,
  "line-join": "round" as const,
};

function visibleBox(sel: string): DOMRect | null {
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el || el.hasAttribute("hidden")) return null;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return r;
}

/** Padding so fitBounds keeps the line in the map gap between HUD chrome. */
export function hudFitPadding(): PaddingOptions {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const cap = (n: number, max: number) => Math.max(24, Math.min(Math.round(n), max));
  const search = visibleBox("#search-card");
  const maneuver = visibleBox("#maneuver");
  const menu = visibleBox("#menu-fab");
  const chip = visibleBox("#posted");
  const driveBar = visibleBox("#drive-bar");
  const review = visibleBox("#review-sheet");
  const rail = visibleBox("#speed-rail");
  const instruments = visibleBox("#speedo");
  let top = 24;
  if (maneuver) top = Math.max(top, maneuver.bottom + 14);
  else if (search && search.top < vh * 0.45) top = Math.max(top, search.bottom + 14);
  else if (menu) top = Math.max(top, menu.bottom + 10);
  if (chip) top = Math.max(top, chip.bottom + 10);
  let bottom = 24;
  if (driveBar) bottom = Math.max(bottom, vh - driveBar.top + 14);
  if (review) bottom = Math.max(bottom, vh - review.top + 16);
  if (rail) bottom = Math.max(bottom, vh - rail.top + 14);
  if (instruments) bottom = Math.max(bottom, vh - instruments.top + 10);
  if (search && search.top >= vh * 0.45) bottom = Math.max(bottom, vh - search.top + 14);
  return {
    top: cap(top, vh * 0.42),
    bottom: cap(bottom, vh * 0.42),
    left: cap(vw < 820 ? 18 : 56, vw * 0.2),
    right: cap(vw < 820 ? 18 : 56, vw * 0.2),
  };
}
