import maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { Look } from "../lib/garage";
import { ago, type RadarItem } from "../lib/reports";
import {
  colorRoute,
  FLOW_SOURCE_LAYER,
  flowPaint,
  incidentAhead,
  localIncidents,
  logTomTomMissing,
  mergeMapIncidents,
  routeTraffic,
  sampleRoute,
  tomtomIncidents,
  trafficAlong,
  trafficStatus,
  trafficSummary,
  TRAFFIC_REFRESH_MS,
  type RouteTraffic,
  type TrafficSummary,
} from "../lib/traffic";
import { KIND_LABEL, SOURCE_LABEL, incidentPinSvg } from "./incident-icons";

export type TrafficHooks = {
  map: MapLibreMap;
  look: () => Look;
  enabled: () => boolean;
  getCenter: () => { lat: number; lon: number };
  getBounds: () => { west: number; south: number; east: number; north: number } | null;
  getRoute: () => { id: string; coords: Array<[number, number]>; durationSec: number; distanceMi: number } | null;
  alongMi: () => number;
  onSummary: (s: TrafficSummary) => void;
  onRouteTraffic?: (rt: RouteTraffic | null) => void;
};

export type TrafficView = {
  refresh(): void;
  setEnabled(on: boolean): void;
  restyle(): void;
  items(): RadarItem[];
};

const emptyFc = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function whenStyle(map: MapLibreMap, fn: () => void): void {
  if (map.isStyleLoaded()) fn();
  else map.once("load", fn);
}

export function mountTraffic(h: TrafficHooks): TrafficView {
  const map = h.map;
  let configured = false;
  let statusKnown = false;
  let items: RadarItem[] = [];
  let markers: Marker[] = [];
  let lastAt = 0;
  let lastCenter: { lat: number; lon: number } | null = null;
  let lastRouteId = "";
  let lastRouteTraffic: RouteTraffic | null = null;
  let busy = false;
  let card: HTMLElement | null = null;

  const ensureCard = () => {
    if (card) return card;
    card = document.createElement("div");
    card.className = "incident-card";
    card.hidden = true;
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Incident");
    document.body.appendChild(card);
    card.addEventListener("click", (e) => {
      if (e.target === card || (e.target as HTMLElement).classList.contains("ic-close")) hideCard();
    });
    return card;
  };

  const hideCard = () => { if (card) card.hidden = true; };

  const showCard = (it: RadarItem) => {
    const el = ensureCard();
    el.innerHTML = `<div class="ic-sheet">
      <button type="button" class="ic-close" aria-label="Close">×</button>
      <span class="ic-pin ${it.kind}" aria-hidden="true">${incidentPinSvg(it.kind)}</span>
      <div class="ic-body">
        <b>${esc(KIND_LABEL[it.kind])}</b>
        <p>${esc(it.title)}</p>
        <span>${esc(it.detail)}</span>
        <small>${esc(SOURCE_LABEL[it.source])} · ${esc(ago(it.createdAt))}</small>
      </div>
    </div>`;
    el.hidden = false;
    el.querySelector(".ic-close")!.addEventListener("click", hideCard);
  };

  const paint = flowPaint(h.look());

  const addLayers = () => {
    whenStyle(map, () => {
      if (!map.getSource("slide-traffic-flow") && configured && h.enabled()) {
        map.addSource("slide-traffic-flow", {
          type: "vector",
          tiles: [`${location.origin}/api/traffic/flow/{z}/{x}/{y}`],
          minzoom: 8,
          maxzoom: 16,
          attribution: "Traffic © TomTom",
        });
        const before = map.getLayer("route-glow") ? "route-glow" : undefined;
        const layer = {
          id: "slide-traffic-flow",
          type: "line" as const,
          source: "slide-traffic-flow",
          "source-layer": FLOW_SOURCE_LAYER,
          minzoom: 10,
          layout: { "line-cap": "round" as const, "line-join": "round" as const },
          paint: {
            "line-color": [
              "interpolate", ["linear"], ["get", "traffic_level"],
              0, paint.heavy,
              0.35, paint.heavy,
              0.55, paint.slow,
              0.78, paint.free,
              1, paint.free,
            ],
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 14, 3.2, 16, 5],
            "line-opacity": 0.88,
          },
        };
        if (before) map.addLayer(layer as never, before);
        else map.addLayer(layer as never);
      }
      if (!map.getSource("slide-traffic-route")) {
        map.addSource("slide-traffic-route", { type: "geojson", data: emptyFc() });
        const before = map.getLayer("route-core") ? "route-core" : map.getLayer("route-line") ? "route-line" : undefined;
        const routeLayer = {
          id: "slide-traffic-route",
          type: "line" as const,
          source: "slide-traffic-route",
          layout: { "line-cap": "round" as const, "line-join": "round" as const, "line-sort-key": 4 },
          paint: {
            "line-color": [
              "match", ["get", "congestion"],
              "heavy", paint.heavy,
              "slow", paint.slow,
              paint.free,
            ],
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.2, 16, 6],
            "line-opacity": 0.96,
          },
        };
        if (before) map.addLayer(routeLayer as never, before);
        else map.addLayer(routeLayer as never);
      }
      applyVisibility();
    });
  };

  const applyVisibility = () => {
    const on = h.enabled() && configured;
    if (map.getLayer("slide-traffic-flow")) {
      map.setLayoutProperty("slide-traffic-flow", "visibility", on ? "visible" : "none");
    }
    if (map.getLayer("slide-traffic-route")) {
      map.setLayoutProperty("slide-traffic-route", "visibility", h.enabled() ? "visible" : "none");
    }
    if (!h.enabled()) {
      clearMarkers();
      hideCard();
      setRouteData([]);
    }
  };

  const restyle = () => {
    const next = flowPaint(h.look());
    whenStyle(map, () => {
      if (map.getLayer("slide-traffic-flow")) {
        map.setPaintProperty("slide-traffic-flow", "line-color", [
          "interpolate", ["linear"], ["get", "traffic_level"],
          0, next.heavy, 0.35, next.heavy, 0.55, next.slow, 0.78, next.free, 1, next.free,
        ]);
      }
      if (map.getLayer("slide-traffic-route")) {
        map.setPaintProperty("slide-traffic-route", "line-color", [
          "match", ["get", "congestion"], "heavy", next.heavy, "slow", next.slow, next.free,
        ]);
      }
    });
  };

  const clearMarkers = () => {
    markers.forEach((m) => m.remove());
    markers = [];
  };

  const drawMarkers = () => {
    clearMarkers();
    if (!h.enabled()) return;
    // Dynamic import of maplibre Marker would pull the app chunk; the map already has it.
    for (const it of items) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `inc-pin ${it.kind}`;
      el.setAttribute("aria-label", `${KIND_LABEL[it.kind]}: ${it.title}`);
      el.innerHTML = incidentPinSvg(it.kind);
      el.addEventListener("click", (e) => { e.stopPropagation(); showCard(it); });
      markers.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([it.lon, it.lat]).addTo(map));
    }
  };

  const setRouteData = (coords: Array<[number, number]>) => {
    whenStyle(map, () => {
      const src = map.getSource("slide-traffic-route") as { setData: (d: FeatureCollection) => void } | undefined;
      if (!src) return;
      const samples = lastRouteTraffic?.samples ?? [];
      const segs = h.enabled() ? colorRoute(coords, samples) : [];
      src.setData({
        type: "FeatureCollection",
        features: segs.map((s) => ({
          type: "Feature" as const,
          properties: { congestion: s.congestion },
          geometry: { type: "LineString" as const, coordinates: [s.a, s.b] },
        })),
      });
    });
  };

  const publish = () => {
    const route = h.getRoute();
    const hit = route ? incidentAhead(items, route.coords, h.alongMi()) : null;
    const sum = trafficSummary({
      traffic: lastRouteTraffic,
      ahead: hit?.item ?? null,
      aheadMi: hit?.mi ?? null,
      tomtom: configured,
      on: h.enabled(),
    });
    h.onSummary(sum);
    h.onRouteTraffic?.(h.enabled() ? lastRouteTraffic : null);
  };

  const poll = async (force = false) => {
    if (busy || document.hidden) return;
    if (!h.enabled() && statusKnown) { publish(); return; }
    const now = Date.now();
    const c = h.getCenter();
    const moved = lastCenter ? Math.hypot(c.lat - lastCenter.lat, c.lon - lastCenter.lon) > 0.04 : true;
    const route = h.getRoute();
    const routeChanged = (route?.id ?? "") !== lastRouteId;
    if (!force && now - lastAt < TRAFFIC_REFRESH_MS && !moved && !routeChanged) return;
    busy = true;
    lastAt = now;
    lastCenter = c;
    lastRouteId = route?.id ?? "";
    try {
      if (!statusKnown) {
        const st = await trafficStatus();
        configured = st.configured;
        statusKnown = true;
        if (!configured) logTomTomMissing();
        addLayers();
      }
      const b = h.getBounds();
      const km = 18;
      const jobs: Array<Promise<RadarItem[]>> = [localIncidents(c.lat, c.lon, km)];
      if (configured && h.enabled() && b) {
        jobs.push(tomtomIncidents([b.west, b.south, b.east, b.north]));
      }
      const lists = await Promise.all(jobs);
      items = mergeMapIncidents(...lists);
      drawMarkers();

      if (configured && h.enabled() && route && route.coords.length > 1) {
        const pts = sampleRoute(route.coords);
        const samples = await trafficAlong(pts);
        lastRouteTraffic = routeTraffic(route.durationSec, route.distanceMi, samples);
        setRouteData(route.coords);
      } else {
        lastRouteTraffic = null;
        setRouteData([]);
      }
      publish();
    } finally {
      busy = false;
    }
  };

  whenStyle(map, () => { addLayers(); void poll(true); });
  map.on("moveend", () => { void poll(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void poll(); });
  window.setInterval(() => { void poll(); }, 15_000);

  return {
    refresh: () => { void poll(true); },
    setEnabled() {
      applyVisibility();
      void poll(true);
    },
    restyle,
    items: () => items,
  };
}
