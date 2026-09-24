import type { Map as MapLibreMap, PaddingOptions } from "maplibre-gl";

/**
 * "Night network" palette (owner's SEKAI reference, docs/DESIGN.md): near-black
 * water, deep graphite land, and roads that read as warm city light — faint on
 * side streets, brightest on motorways. Kept above the old pure-black OpenFreeMap
 * dark so the map never reads as a blank screen on a phone.
 */
const LAND = "#0d1014";
const WATER = "#05080c";
const ROAD = "#8a6a42";
const ROAD_CASE = "#1c1812";
const MOTORWAY = "#c8914c";
const MINOR = "#3b3429";
const PARK = "#0f1a14";
const BUILDING = "#1a1814";
const LABEL = "#d8d4ca";
const HALO = "#05070a";

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
  paint(map, "landcover_glacier", "fill-color", "#151a20");
  paint(map, "landuse_residential", "fill-color", "#11141a");
  paint(map, "landcover_wood", "fill-color", PARK);
  paint(map, "landuse_park", "fill-color", PARK);
  paint(map, "building", "fill-color", BUILDING);
  paint(map, "building", "fill-outline-color", "#2a251d");
  paint(map, "highway_path", "line-color", "#2c2720");
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
  paint(map, "highway_motorway_inner", "line-blur", 0.6);
  paint(map, "highway_major_inner", "line-blur", 0.4);
  paint(map, "highway_motorway_inner", "line-width", ["interpolate", ["linear"], ["zoom"], 8, 1.2, 12, 2.2, 16, 4]);
  paint(map, "highway_motorway_subtle", "line-color", MOTORWAY);
  paint(map, "aeroway-taxiway", "line-color", ROAD);
  paint(map, "aeroway-runway-casing", "line-color", ROAD_CASE);
  paint(map, "aeroway-runway", "line-color", ROAD);
  paint(map, "aeroway-area", "fill-color", "#15181d");
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
    map.setLight({ anchor: "viewport", color: "#ffd9a8", intensity: 0.34 });
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
    "#1c1a16",
    40,
    "#26221b",
    120,
    "#332c22",
  ],
  "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 14],
  "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
  "fill-extrusion-opacity": 0.86,
};

type Expr = unknown;

/**
 * Zoom-scaled value that differs for the selected line. MapLibre only accepts
 * `zoom` as the input of a *top-level* interpolate, so the selected/alternate
 * `case` has to live inside each stop — `["case", on, <zoom interpolate>, ..]` is
 * rejected and the whole layer silently fails to draw.
 */
function byZoom(on: Expr, selected: [number, number], alternate: [number, number]) {
  return ["interpolate", ["linear"], ["zoom"], 11, ["case", on, selected[0], alternate[0]], 16, ["case", on, selected[1], alternate[1]]];
}


/**
 * Selected ribbon, SEKAI style: a wide soft halo in the trail colour under a thin
 * bright white line. Alternates are a quiet grey hairline so the choice reads at a glance.
 */
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
      "line-width": byZoom(on, [20, 36], [6, 10]),
      "line-opacity": ["case", on, 0.34, 0.06],
      "line-blur": byZoom(on, [8, 14], [4, 4]),
    },
    case: {
      "line-color": "#05070a",
      "line-width": byZoom(on, [8, 12], [4, 6]),
      "line-opacity": ["case", on, 0.7, 0.6],
    },
    line: {
      "line-color": ["case", on, "#f4f3ef", "#6d6c72"],
      "line-width": byZoom(on, [4, 6.5], [2, 3.5]),
      "line-opacity": ["case", on, 0.96, 0.7],
    },
    core: {
      "line-color": "#ffffff",
      "line-width": byZoom(on, [1.2, 2], [0, 0]),
      "line-opacity": ["case", on, 1, 0],
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
