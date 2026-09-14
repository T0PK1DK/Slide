import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

/** Run after the style graph exists so addLayer / getSource cannot throw. */
export function whenStyleReady(map: MapLibreMap, fn: () => void): void {
  try {
    if (map.isStyleLoaded()) {
      fn();
      return;
    }
  } catch {
    // MapLibre throws if the style object is not constructed yet.
  }
  map.once("load", fn);
}

export function styleIsReady(map: MapLibreMap): boolean {
  try {
    return map.isStyleLoaded() === true;
  } catch {
    return false;
  }
}

export function getGeoJsonSource(map: MapLibreMap, id: string): GeoJSONSource | undefined {
  if (!styleIsReady(map)) return undefined;
  return map.getSource(id) as GeoJSONSource | undefined;
}

export function emptyFeatureCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
