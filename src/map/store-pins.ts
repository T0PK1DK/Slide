import maplibregl, { type ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { mountHologram, prefersReducedMotion, type HologramDispose } from "../look/hologram";
import { categoryIconPath, contrastInk, hasBundledMark, monogramLetter, monogramPair, pinColor } from "../look/marks";
import {
  PIN_DROP_MS,
  PIN_SELECT_MS,
  haloPulse,
  haloRadiusExpr,
  pinDropPaint,
  pinSelectScale,
  pinSizeExpr,
  selectedPinSizeExpr,
  storeIdsKey,
} from "../look/motion";
import { modelKeyOf, storeId, storeLngLat, type Store } from "../look/types";

export const STORE_SOURCE = "slide-look-stores";
export const STORE_LAYER_CLUSTERS = "slide-look-clusters";
export const STORE_LAYER_CLUSTER_GLOW = "slide-look-cluster-glow";
export const STORE_LAYER_COUNT = "slide-look-cluster-count";
export const STORE_LAYER_PINS = "slide-look-pins";
export const STORE_LAYER_SELECTED = "slide-look-pins-selected";
export const STORE_LAYER_HALO = "slide-look-halo";
export const CLUSTER_RADIUS = 52;
export const CLUSTER_MAX_ZOOM = 14;
export const CLUSTER_MIN_RADIUS = 18;

export function clusterDiscRadiusExpr(): unknown[] {
  return ["step", ["get", "point_count"], CLUSTER_MIN_RADIUS, 3, 22, 8, 26, 18, 32];
}

export function clusterGlowRadiusExpr(): unknown[] {
  return ["step", ["get", "point_count"], CLUSTER_MIN_RADIUS + 16, 3, 38, 8, 46, 18, 56];
}

export function lookThemeIsDay(): boolean {
  try {
    return typeof document !== "undefined" && document.documentElement.dataset.look === "day";
  } catch {
    return false;
  }
}

export function pinLabelPaint(day: boolean): { color: string; halo: string } {
  return day
    ? { color: "#1c1812", halo: "rgba(255, 250, 241, 0.9)" }
    : { color: "#f4f3ef", halo: "rgba(8,10,12,0.78)" };
}

export function clusterStrokeColor(day: boolean): string {
  return day ? "rgba(40, 28, 12, 0.55)" : "rgba(255,255,255,0.96)";
}

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
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText(`${letter}${rest}`, 32, 26);
    } else {
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.fillText(letter, 32, 26);
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
  setDropProgress(progress: number): void;
  setSelectProgress(progress: number): void;
  destroy(): void;
};

export type StorePinsHooks = {
  map: maplibregl.Map;
  onSelect?: (store: Store) => void;
  onDeselect?: () => void;
};

function whenStyle(map: maplibregl.Map, fn: () => void): void {
  if (map.isStyleLoaded()) fn();
  else map.once("idle", fn);
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
  let idsKey = "";
  let dropRaf = 0;
  let selectRaf = 0;
  let haloRaf = 0;

  const images = new Set<string>();
  const pinLayers = () => [STORE_LAYER_PINS, STORE_LAYER_SELECTED];

  const paintDrop = (progress: number) => {
    const { translate, opacity } = pinDropPaint(progress);
    for (const id of pinLayers()) {
      if (!map.getLayer(id)) continue;
      map.setPaintProperty(id, "icon-translate-anchor", "viewport");
      map.setPaintProperty(id, "text-translate-anchor", "viewport");
      map.setPaintProperty(id, "icon-translate", translate);
      map.setPaintProperty(id, "text-translate", translate);
      map.setPaintProperty(id, "icon-opacity", opacity);
      map.setPaintProperty(id, "text-opacity", opacity);
    }
  };

  const startDrop = () => {
    cancelAnimationFrame(dropRaf);
    if (prefersReducedMotion()) {
      paintDrop(1);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / PIN_DROP_MS);
      paintDrop(p);
      if (p < 1) dropRaf = requestAnimationFrame(tick);
    };
    paintDrop(0);
    dropRaf = requestAnimationFrame(tick);
  };

  const paintSelect = (progress: number) => {
    if (!map.getLayer(STORE_LAYER_SELECTED)) return;
    map.setLayoutProperty(
      STORE_LAYER_SELECTED,
      "icon-size",
      selectedPinSizeExpr(pinSelectScale(progress)) as ExpressionSpecification,
    );
  };

  const startSelect = () => {
    cancelAnimationFrame(selectRaf);
    if (!selected) return;
    if (prefersReducedMotion()) {
      paintSelect(1);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / PIN_SELECT_MS);
      paintSelect(p);
      if (p < 1) selectRaf = requestAnimationFrame(tick);
    };
    paintSelect(0);
    selectRaf = requestAnimationFrame(tick);
  };

  const stopHalo = () => {
    cancelAnimationFrame(haloRaf);
    haloRaf = 0;
    if (map.getLayer(STORE_LAYER_HALO)) {
      map.setPaintProperty(STORE_LAYER_HALO, "circle-radius", haloRadiusExpr(0) as ExpressionSpecification);
      map.setPaintProperty(STORE_LAYER_HALO, "circle-opacity", 0.2);
    }
  };

  const startHalo = () => {
    stopHalo();
    if (!selected || !visible) return;
    const tick = (now: number) => {
      if (!selected || !visible || !map.getLayer(STORE_LAYER_HALO)) return;
      const pulse = prefersReducedMotion() ? { radiusBoost: 3, opacity: 0.22 } : haloPulse(now);
      map.setPaintProperty(STORE_LAYER_HALO, "circle-radius", haloRadiusExpr(pulse.radiusBoost) as ExpressionSpecification);
      map.setPaintProperty(STORE_LAYER_HALO, "circle-opacity", pulse.opacity);
      if (!prefersReducedMotion()) haloRaf = requestAnimationFrame(tick);
    };
    haloRaf = requestAnimationFrame(tick);
  };

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
    el.className = "look-holo-float is-in";
    disposeHolo = mountHologram(el, { modelKey: modelKeyOf(store), color: pinColor(store) });
    holo = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -30] }).setLngLat(lngLat).addTo(map);
  };

  const apply = () => {
    const fc = storesToFeatureCollection(stores);
    for (const s of stores) ensureImage(s);
    const src = map.getSource(STORE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    if (selected && !byId.has(selected)) selected = null;
    const vis = visible ? "visible" : "none";
    for (const id of [
      STORE_LAYER_CLUSTER_GLOW,
      STORE_LAYER_CLUSTERS,
      STORE_LAYER_COUNT,
      STORE_LAYER_PINS,
      STORE_LAYER_SELECTED,
      STORE_LAYER_HALO,
    ]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
    if (map.getLayer(STORE_LAYER_PINS)) {
      map.setFilter(STORE_LAYER_PINS, [
        "all",
        ["!", ["has", "point_count"]],
        ["!=", ["get", "id"], selected ?? ""],
      ]);
      map.setLayoutProperty(STORE_LAYER_PINS, "icon-size", pinSizeExpr(null) as ExpressionSpecification);
    }
    if (map.getLayer(STORE_LAYER_SELECTED)) {
      map.setFilter(STORE_LAYER_SELECTED, ["==", ["get", "id"], selected ?? ""]);
    }
    if (map.getLayer(STORE_LAYER_HALO)) {
      map.setFilter(STORE_LAYER_HALO, ["==", ["get", "id"], selected ?? ""]);
    }
    paintHolo();
    if (selected && visible) startHalo();
    else stopHalo();
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
      const day = lookThemeIsDay();
      const label = pinLabelPaint(day);
      map.addLayer({
        id: STORE_LAYER_CLUSTER_GLOW,
        type: "circle",
        source: STORE_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(240,160,75,0.55)",
          "circle-radius": clusterGlowRadiusExpr() as ExpressionSpecification,
          "circle-blur": 0.85,
          "circle-opacity": 0.95,
          "circle-pitch-alignment": "viewport",
        },
      });
      map.addLayer({
        id: STORE_LAYER_CLUSTERS,
        type: "circle",
        source: STORE_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "rgba(240,160,75,0.96)",
            6,
            "rgba(232,140,56,0.97)",
            14,
            "rgba(220,118,42,0.98)",
          ],
          "circle-stroke-color": clusterStrokeColor(day),
          "circle-stroke-width": 3,
          "circle-radius": clusterDiscRadiusExpr() as ExpressionSpecification,
          "circle-opacity": 0.98,
          "circle-pitch-alignment": "viewport",
        },
      });
      map.addLayer({
        id: STORE_LAYER_COUNT,
        type: "symbol",
        source: STORE_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "point_count_abbreviated"]],
          "text-size": ["step", ["get", "point_count"], 13, 8, 14, 16, 15],
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#1a140c",
          "text-halo-color": "rgba(255,244,220,0.55)",
          "text-halo-width": 0.6,
        },
      });
      map.addLayer({
        id: STORE_LAYER_HALO,
        type: "circle",
        source: STORE_SOURCE,
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": haloRadiusExpr(0) as ExpressionSpecification,
          "circle-color": "rgba(240,160,75,0.28)",
          "circle-opacity": 0.28,
          "circle-stroke-width": 2.4,
          "circle-stroke-color": "rgba(240,160,75,0.95)",
          "circle-blur": 0.18,
          "circle-pitch-alignment": "viewport",
        },
      });
      map.addLayer({
        id: STORE_LAYER_PINS,
        type: "symbol",
        source: STORE_SOURCE,
        filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], ""]],
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": pinSizeExpr(null) as ExpressionSpecification,
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
          "text-color": label.color,
          "text-halo-color": label.halo,
          "text-halo-width": day ? 1.6 : 1.2,
          "icon-translate": [0, 0],
          "icon-translate-anchor": "viewport",
          "icon-opacity": 1,
          "text-translate": [0, 0],
          "text-translate-anchor": "viewport",
          "text-opacity": 1,
        },
      });
      map.addLayer({
        id: STORE_LAYER_SELECTED,
        type: "symbol",
        source: STORE_SOURCE,
        filter: ["==", ["get", "id"], ""],
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": selectedPinSizeExpr(1) as ExpressionSpecification,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-padding": 2,
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-offset": [0, 0.42],
          "text-anchor": "top",
          "text-optional": true,
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
        },
        paint: {
          "text-color": label.color,
          "text-halo-color": label.halo,
          "text-halo-width": day ? 1.8 : 1.4,
          "icon-translate": [0, 0],
          "icon-translate-anchor": "viewport",
          "icon-opacity": 1,
          "text-translate": [0, 0],
          "text-translate-anchor": "viewport",
          "text-opacity": 1,
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

    const onPinClick = (e: { features?: { properties?: { id?: unknown } }[] }) => {
      const id = String(e.features?.[0]?.properties?.id ?? "");
      const store = byId.get(id);
      if (!store) return;
      selected = id;
      apply();
      startSelect();
      hooks.onSelect?.(store);
    };
    map.on("click", STORE_LAYER_PINS, onPinClick);
    map.on("click", STORE_LAYER_SELECTED, onPinClick);

    for (const id of [STORE_LAYER_PINS, STORE_LAYER_SELECTED, STORE_LAYER_CLUSTERS]) {
      map.on("mouseenter", id, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", id, () => {
        map.getCanvas().style.cursor = "";
      });
    }

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
      const nextKey = storeIdsKey([...byId.keys()]);
      const dropped = nextKey !== idsKey && next.length > 0;
      idsKey = nextKey;
      whenStyle(map, () => {
        apply();
        if (dropped && visible) startDrop();
      });
    },
    setDropProgress(progress) {
      cancelAnimationFrame(dropRaf);
      paintDrop(progress);
      whenStyle(map, () => paintDrop(progress));
    },
    setSelectProgress(progress) {
      cancelAnimationFrame(selectRaf);
      paintSelect(progress);
      whenStyle(map, () => paintSelect(progress));
    },
    select(id) {
      selected = id;
      whenStyle(map, () => {
        apply();
        if (id) startSelect();
      });
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
      cancelAnimationFrame(dropRaf);
      cancelAnimationFrame(selectRaf);
      stopHalo();
      disposeHolo?.();
      holo?.remove();
      for (const id of [
        STORE_LAYER_SELECTED,
        STORE_LAYER_PINS,
        STORE_LAYER_HALO,
        STORE_LAYER_COUNT,
        STORE_LAYER_CLUSTERS,
        STORE_LAYER_CLUSTER_GLOW,
      ]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(STORE_SOURCE)) map.removeSource(STORE_SOURCE);
    },
  };
}
