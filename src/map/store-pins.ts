import maplibregl from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { mountHologram, type HologramDispose } from "../look/hologram";
import { categoryIconPath, contrastInk, hasBundledMark, monogramLetter, monogramPair, pinColor } from "../look/marks";
import { modelKeyOf, storeId, storeLngLat, type Store } from "../look/types";

export const STORE_SOURCE = "slide-look-stores";
export const STORE_LAYER_CLUSTERS = "slide-look-clusters";
export const STORE_LAYER_COUNT = "slide-look-cluster-count";
export const STORE_LAYER_PINS = "slide-look-pins";
export const STORE_LAYER_HALO = "slide-look-halo";
export const CLUSTER_RADIUS = 52;
export const CLUSTER_MAX_ZOOM = 14;

export function storesToFeatureCollection(stores: Store[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stores.flatMap((store) => {
      const lngLat = storeLngLat(store);
      if (!lngLat) return [];
      const id = storeId(store);
      return [
        {
          type: "Feature" as const,
          id,
          geometry: { type: "Point" as const, coordinates: lngLat },
          properties: {
            id,
            name: store.name ?? "",
            brandKey: store.brandKey ?? "",
            category: store.category ?? "other",
            color: pinColor(store),
            letter: monogramLetter(store),
            icon: pinImageId(store),
          },
        },
      ];
    }),
  };
}

export function pinImageId(store: Pick<Store, "brandKey" | "category" | "color" | "name" | "brand">): string {
  const color = pinColor(store).slice(1);
  const letter = monogramLetter(store);
  const kind = hasBundledMark(store) ? "m" : `c-${store.category ?? "other"}`;
  return `look-pin-${kind}-${letter}-${color}`;
}

function drawCategoryGlyph(ctx: CanvasRenderingContext2D, category: Store["category"], ink: string): void {
  ctx.save();
  ctx.translate(16, 8);
  ctx.scale(32 / 24, 32 / 24);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (typeof Path2D === "function") {
    ctx.stroke(new Path2D(categoryIconPath(category)));
  } else {
    ctx.beginPath();
    ctx.moveTo(7, 9);
    ctx.lineTo(17, 9);
    ctx.lineTo(16, 20);
    ctx.lineTo(8, 20);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPinCanvas(
  color: string,
  letter: string,
  categoryFallback: boolean,
  rest = "",
  category?: Store["category"],
): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.shadowColor = "rgba(8,10,12,0.42)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.moveTo(32, 60);
  ctx.quadraticCurveTo(14, 42, 14, 28);
  ctx.arc(32, 26, 20, Math.PI * 0.82, Math.PI * 0.18);
  ctx.quadraticCurveTo(50, 42, 32, 60);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(32, 58);
  ctx.quadraticCurveTo(16, 42, 16, 28);
  ctx.arc(32, 26, 18, Math.PI * 0.82, Math.PI * 0.18);
  ctx.quadraticCurveTo(48, 42, 32, 58);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(24, 18, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();

  const ink = contrastInk(color);
  if (categoryFallback) {
    drawCategoryGlyph(ctx, category, ink);
  } else {
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (rest) {
      ctx.font = "700 17px system-ui, sans-serif";
      ctx.fillText(`${letter}${rest}`, 32, 27);
    } else {
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText(letter, 32, 27);
    }
  }
  return c;
}

export type StorePinsHandle = {
  setStores(stores: Store[]): void;
  select(id: string | null): void;
  selected(): string | null;
  storeById(id: string): Store | undefined;
  setVisible(on: boolean): void;
  destroy(): void;
};

export type StorePinsHooks = {
  map: maplibregl.Map;
  onSelect?: (store: Store) => void;
  onDeselect?: () => void;
};

function whenStyle(map: maplibregl.Map, fn: () => void): void {
  if (map.isStyleLoaded()) fn();
  else map.once("load", fn);
}

export function mountStorePins(hooks: StorePinsHooks): StorePinsHandle {
  const map = hooks.map;
  let stores: Store[] = [];
  const byId = new Map<string, Store>();
  let selected: string | null = null;
  let visible = true;
  let holo: maplibregl.Marker | null = null;
  let disposeHolo: HologramDispose | null = null;
  let bound = false;

  const images = new Set<string>();

  const ensureImage = (store: Store) => {
    const id = pinImageId(store);
    if (images.has(id) || map.hasImage(id)) {
      images.add(id);
      return;
    }
    const pair = monogramPair(store);
    const canvas = drawPinCanvas(
      pinColor(store),
      pair.lead,
      !hasBundledMark(store),
      pair.rest,
      store.category,
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    map.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 });
    images.add(id);
  };

  const paintHolo = () => {
    disposeHolo?.();
    disposeHolo = null;
    holo?.remove();
    holo = null;
    if (!selected || !visible) return;
    const store = byId.get(selected);
    const lngLat = store ? storeLngLat(store) : null;
    if (!store || !lngLat) return;
    const el = document.createElement("div");
    el.className = "look-holo-float";
    disposeHolo = mountHologram(el, { modelKey: modelKeyOf(store), color: pinColor(store) });
    holo = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -28] }).setLngLat(lngLat).addTo(map);
  };

  const apply = () => {
    const fc = storesToFeatureCollection(stores);
    for (const s of stores) ensureImage(s);
    const src = map.getSource(STORE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    if (selected && !byId.has(selected)) selected = null;
    const vis = visible ? "visible" : "none";
    for (const id of [STORE_LAYER_CLUSTERS, STORE_LAYER_COUNT, STORE_LAYER_PINS, STORE_LAYER_HALO]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
    if (map.getLayer(STORE_LAYER_HALO)) {
      map.setFilter(STORE_LAYER_HALO, ["==", ["get", "id"], selected ?? ""]);
    }
    paintHolo();
  };

  const bind = () => {
    if (bound || !map.getStyle()) return;
    bound = true;
    if (!map.getSource(STORE_SOURCE)) {
      map.addSource(STORE_SOURCE, {
        type: "geojson",
        data: storesToFeatureCollection([]),
        cluster: true,
        clusterRadius: CLUSTER_RADIUS,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
      });
    }
    if (!map.getLayer(STORE_LAYER_CLUSTERS)) {
      map.addLayer({
        id: STORE_LAYER_CLUSTERS,
        type: "circle",
        source: STORE_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(240,160,75,0.88)",
          "circle-stroke-color": "rgba(255,255,255,0.92)",
          "circle-stroke-width": 2.4,
          "circle-radius": ["step", ["get", "point_count"], 15, 6, 18, 14, 22],
          "circle-opacity": 0.96,
          "circle-blur": 0.05,
        },
      });
      map.addLayer({
        id: STORE_LAYER_COUNT,
        type: "symbol",
        source: STORE_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "point_count_abbreviated"]],
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#1a140c",
        },
      });
      map.addLayer({
        id: STORE_LAYER_HALO,
        type: "circle",
        source: STORE_SOURCE,
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 12, 16, 26],
          "circle-color": "rgba(240,160,75,0.18)",
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(240,160,75,0.9)",
          "circle-blur": 0.15,
        },
      });
      map.addLayer({
        id: STORE_LAYER_PINS,
        type: "symbol",
        source: STORE_SOURCE,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 13, 0.9, 16, 1.08],
          "icon-anchor": "bottom",
          "icon-allow-overlap": false,
          "icon-ignore-placement": false,
          "icon-padding": 4,
          "text-field": ["step", ["zoom"], "", 15, ["get", "name"]],
          "text-size": 11,
          "text-offset": [0, 0.35],
          "text-anchor": "top",
          "text-optional": true,
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
        },
        paint: {
          "text-color": "#f4f3ef",
          "text-halo-color": "rgba(8,10,12,0.78)",
          "text-halo-width": 1.2,
        },
      });
    }

    map.on("click", STORE_LAYER_CLUSTERS, (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const coords = f.geometry.coordinates as [number, number];
      const clusterId = Number(f.properties?.cluster_id);
      const src = map.getSource(STORE_SOURCE) as maplibregl.GeoJSONSource;
      void src.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: coords, zoom });
      });
    });

    map.on("click", STORE_LAYER_PINS, (e) => {
      const id = String(e.features?.[0]?.properties?.id ?? "");
      const store = byId.get(id);
      if (!store) return;
      selected = id;
      apply();
      hooks.onSelect?.(store);
    });

    map.on("mouseenter", STORE_LAYER_PINS, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", STORE_LAYER_PINS, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", STORE_LAYER_CLUSTERS, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", STORE_LAYER_CLUSTERS, () => {
      map.getCanvas().style.cursor = "";
    });

    apply();
  };

  whenStyle(map, bind);
  map.on("styledata", () => {
    if (!map.getSource(STORE_SOURCE)) {
      bound = false;
      images.clear();
      whenStyle(map, bind);
    }
  });

  return {
    setStores(next) {
      stores = next;
      byId.clear();
      for (const s of next) byId.set(storeId(s), s);
      whenStyle(map, apply);
    },
    select(id) {
      selected = id;
      whenStyle(map, apply);
    },
    selected: () => selected,
    storeById: (id) => byId.get(id),
    setVisible(on) {
      visible = on;
      if (!on) {
        disposeHolo?.();
        disposeHolo = null;
        holo?.remove();
        holo = null;
      }
      whenStyle(map, apply);
    },
    destroy() {
      disposeHolo?.();
      holo?.remove();
      if (map.getLayer(STORE_LAYER_PINS)) map.removeLayer(STORE_LAYER_PINS);
      if (map.getLayer(STORE_LAYER_HALO)) map.removeLayer(STORE_LAYER_HALO);
      if (map.getLayer(STORE_LAYER_COUNT)) map.removeLayer(STORE_LAYER_COUNT);
      if (map.getLayer(STORE_LAYER_CLUSTERS)) map.removeLayer(STORE_LAYER_CLUSTERS);
      if (map.getSource(STORE_SOURCE)) map.removeSource(STORE_SOURCE);
    },
  };
}
