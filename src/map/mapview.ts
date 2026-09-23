import type { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";

type MapLibreNS = {
  Map: { new (...args: ConstructorParameters<typeof MapLibreMap>): MapLibreMap };
  Marker: { new (...args: ConstructorParameters<typeof Marker>): Marker };
  LngLatBounds: { new (...args: ConstructorParameters<typeof LngLatBounds>): LngLatBounds };
  AttributionControl: { new (...args: ConstructorParameters<typeof AttributionControl>): AttributionControl };
};
import {
  BUILDING_PAINT,
  hudFitPadding,
  liftNightBasemap,
  LINE_LAYOUT,
  routeLayerPaints,
} from "../lib/maplook";
import { fetchJson } from "../lib/net";
import { cacheStyle, getCachedStyle } from "../lib/sessionCache";
import { TRAILS, type GarageConfig } from "../lib/garage";

export const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export type MapView = {
  map: MapLibreMap;
  whenStyleReady: (fn: () => void) => void;
  markReady: () => void;
  addRouteLayers: () => void;
  paintRouteColors: (trailLine: string) => void;
  ensure3DBuildings: () => void;
  toggleBuildings: (on: boolean) => void;
  applyCamera: (mode: GarageConfig["camera"]) => void;
  applyPlanView: (showBuildings: boolean) => void;
  fitToRoute: (coords: [number, number][], mode: "plan" | "review" | "drive") => void;
};

function emptyFc() {
  return { type: "FeatureCollection" as const, features: [] };
}

export async function loadStyleJson(): Promise<StyleSpecification> {
  const cached = getCachedStyle();
  if (cached) return cached as StyleSpecification;
  const style = await fetchJson<StyleSpecification>(STYLE_URL, {}, 10000);
  cacheStyle(style);
  return style;
}

export function afterFirstPaint(fn: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

export async function createMapView(
  maplibregl: MapLibreNS,
  garage: GarageConfig,
  miami: { lon: number; lat: number }
): Promise<MapView> {
  let styleReady = false;
  const styleQueue: Array<() => void> = [];
  const style = await loadStyleJson().catch(() => STYLE_URL);

  const map = new maplibregl.Map({
    container: "map",
    style,
    center: [miami.lon, miami.lat],
    zoom: 14.2,
    pitch: 58,
    bearing: -18,
    attributionControl: false,
    maxPitch: 75,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

  const whenStyleReady = (fn: () => void) => {
    if (styleReady) fn();
    else styleQueue.push(fn);
  };

  const markReady = () => {
    const canvas = document.getElementById("map");
    canvas?.classList.add("is-ready");
    canvas?.classList.remove("map-pending");
    document.getElementById("skel-map")?.setAttribute("hidden", "");
    document.body.classList.add("map-ready");
  };

  const addRouteLayers = () => {
    if (map.getSource("routes")) return;
    map.addSource("routes", { type: "geojson", data: emptyFc() });
    map.addSource("ghost-trails", { type: "geojson", data: emptyFc() });
    const paint = routeLayerPaints(TRAILS[garage.trail].line);
    map.addLayer({ id: "route-glow", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.glow as never });
    map.addLayer({ id: "route-case", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.case as never });
    map.addLayer({ id: "route-line", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.line as never });
    map.addLayer({ id: "route-core", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.core as never });
    map.addLayer({
      id: "ghost-trails",
      type: "line",
      source: "ghost-trails",
      paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.55, "line-dasharray": [1, 1.2] },
    });
  };

  const paintRouteColors = (trailLine: string) => {
    if (map.getLayer("route-glow")) map.setPaintProperty("route-glow", "line-color", trailLine);
    const next = routeLayerPaints(trailLine);
    if (map.getLayer("route-line")) map.setPaintProperty("route-line", "line-color", next.line["line-color"] as never);
    if (map.getLayer("route-core")) map.setPaintProperty("route-core", "line-color", next.core["line-color"] as never);
  };

  const ensure3DBuildings = () => {
    if (map.getLayer("slide-buildings")) return;
    const sourceId = map.getSource("openmaptiles") ? "openmaptiles" : Object.keys(map.getStyle().sources || {})[0];
    if (!sourceId) return;
    try {
      map.addLayer({
        id: "slide-buildings",
        source: sourceId,
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 13,
        paint: BUILDING_PAINT as never,
      });
    } catch {
      // Style without a building source-layer.
    }
    toggleBuildings(garage.showBuildings);
  };

  const toggleBuildings = (on: boolean) => {
    if (map.getLayer("slide-buildings")) map.setLayoutProperty("slide-buildings", "visibility", on ? "visible" : "none");
  };

  const applyCamera = (mode: GarageConfig["camera"]) => {
    if (mode === "top") map.easeTo({ pitch: 0, zoom: Math.max(map.getZoom(), 13), duration: 700 });
    else if (mode === "chase") map.easeTo({ pitch: 62, zoom: 16.2, duration: 700 });
    else map.easeTo({ pitch: 56, zoom: 14.6, duration: 700 });
  };

  const applyPlanView = (showBuildings: boolean) => {
    const phone = window.innerWidth < 820;
    toggleBuildings(phone ? false : showBuildings);
    if (phone) map.easeTo({ pitch: 8, bearing: 0, zoom: Math.max(map.getZoom(), 11.3), duration: 700 });
    else applyCamera(garage.camera);
  };

  const fitToRoute = (selectedCoords: [number, number][], hudMode: "plan" | "review" | "drive") => {
    if (!selectedCoords.length) return;
    whenStyleReady(() => {
      const bounds = new maplibregl.LngLatBounds(selectedCoords[0], selectedCoords[0]);
      for (const c of selectedCoords) bounds.extend(c);
      const phone = window.innerWidth < 820;
      const reviewing = hudMode === "review";
      map.fitBounds(bounds, {
        padding: hudFitPadding(),
        pitch: reviewing ? (phone ? 8 : 18) : phone ? 48 : 52,
        bearing: reviewing ? 0 : -18,
        maxZoom: reviewing ? (phone ? 13.6 : 14.2) : phone ? 15.2 : 15.4,
        duration: 1100,
      });
    });
  };

  map.on("load", () => {
    styleReady = true;
    liftNightBasemap(map);
    addRouteLayers();
    markReady();
    styleQueue.splice(0).forEach((fn) => fn());
    afterFirstPaint(() => {
      if (garage.showBuildings && window.innerWidth >= 820) ensure3DBuildings();
    });
  });
  map.on("error", () => {
    markReady();
  });

  return {
    map,
    whenStyleReady,
    markReady,
    addRouteLayers,
    paintRouteColors,
    ensure3DBuildings,
    toggleBuildings,
    applyCamera,
    applyPlanView,
    fitToRoute,
  };
}
