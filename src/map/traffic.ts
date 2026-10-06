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
  fetchTrafficRoute,
  routeTraffic,
  routeTrafficFromRouting,
  sampleRoute,
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
  /**
   * Every traffic measurement for the selected line goes to the route brain
   * first (src/lib/route-brain.ts). `routeId` is the line it was measured on
   * (a late answer for a line the driver already left is ignored there).
   * `why`: "ok" = measured, "failed" = TomTom/flow gave nothing (quota,
   * timeout, no coverage), "off" = the driver turned traffic off.
   */
  onRouteTraffic?: (rt: RouteTraffic | null, routeId: string, why: "ok" | "failed" | "off") => void;
  /** The brain's committed delay, so "+N min" copy matches the ETA on screen. */
  committedDelaySec?: () => number | null;
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
  /** Line id the current lastRouteTraffic was measured on. */
  let lastMeasuredId = "";
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

  const flowColor = (p: ReturnType<typeof flowPaint>) => [
    "interpolate", ["linear"], ["get", "traffic_level"],
    0, p.heavy, 0.35, p.heavy, 0.55, p.slow, 0.78, p.free, 1, p.free,
  ];
  const routeColor = (p: ReturnType<typeof flowPaint>) => [
    "match", ["get", "congestion"], "heavy", p.heavy, "slow", p.slow, p.free,
  ];

  const addLayers = () => {
    whenStyle(map, () => {
      const paint = flowPaint(h.look());
      if (!map.getSource("slide-traffic-flow") && configured && h.enabled()) {
        map.addSource("slide-traffic-flow", {
          type: "vector",
          tiles: [`${location.origin}/api/traffic/flow/{z}/{x}/{y}`],
          minzoom: 8,
          maxzoom: 16,
          attribution: "Traffic © TomTom",
        });
        const before = map.getLayer("route-glow") ? "route-glow" : undefined;
        const flowCase = {
          id: "slide-traffic-flow-case",
          type: "line" as const,
          source: "slide-traffic-flow",
          "source-layer": FLOW_SOURCE_LAYER,
          minzoom: 10,
          layout: { "line-cap": "round" as const, "line-join": "round" as const },
          paint: {
            "line-color": paint.case,
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.8, 14, 4.8, 16, 7],
            "line-opacity": 0.78,
          },
        };
        const layer = {
          id: "slide-traffic-flow",
          type: "line" as const,
          source: "slide-traffic-flow",
          "source-layer": FLOW_SOURCE_LAYER,
          minzoom: 10,
          layout: { "line-cap": "round" as const, "line-join": "round" as const },
          paint: {
            "line-color": flowColor(paint),
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 14, 3.2, 16, 5],
            "line-opacity": 0.94,
          },
        };
        if (before) {
          map.addLayer(flowCase as never, before);
          map.addLayer(layer as never, before);
        } else {
          map.addLayer(flowCase as never);
          map.addLayer(layer as never);
        }
      }
      if (!map.getSource("slide-traffic-route")) {
        map.addSource("slide-traffic-route", { type: "geojson", data: emptyFc() });
        const before = map.getLayer("route-core") ? "route-core" : map.getLayer("route-line") ? "route-line" : undefined;
        const routeCase = {
          id: "slide-traffic-route-case",
          type: "line" as const,
          source: "slide-traffic-route",
          layout: { "line-cap": "round" as const, "line-join": "round" as const, "line-sort-key": 3 },
          paint: {
            "line-color": paint.case,
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4.6, 16, 8],
            "line-opacity": 0.72,
          },
        };
        const routeLayer = {
          id: "slide-traffic-route",
          type: "line" as const,
          source: "slide-traffic-route",
          layout: { "line-cap": "round" as const, "line-join": "round" as const, "line-sort-key": 4 },
          paint: {
            "line-color": routeColor(paint),
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.2, 16, 6],
            "line-opacity": 0.96,
          },
        };
        if (before) {
          map.addLayer(routeCase as never, before);
          map.addLayer(routeLayer as never, before);
        } else {
          map.addLayer(routeCase as never);
          map.addLayer(routeLayer as never);
        }
      }
      applyVisibility();
    });
  };

  const setLayerVis = (id: string, vis: "visible" | "none") => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
  };

  const applyVisibility = () => {
    const flowOn = h.enabled() && configured ? "visible" : "none";
    const routeOn = h.enabled() ? "visible" : "none";
    setLayerVis("slide-traffic-flow-case", flowOn);
    setLayerVis("slide-traffic-flow", flowOn);
    setLayerVis("slide-traffic-route-case", routeOn);
    setLayerVis("slide-traffic-route", routeOn);
    if (!h.enabled()) {
      clearMarkers();
      hideCard();
      setRouteData([]);
    }
  };

  const restyle = () => {
    const next = flowPaint(h.look());
    whenStyle(map, () => {
      if (map.getLayer("slide-traffic-flow-case")) {
        map.setPaintProperty("slide-traffic-flow-case", "line-color", next.case);
      }
      if (map.getLayer("slide-traffic-flow")) {
        map.setPaintProperty("slide-traffic-flow", "line-color", flowColor(next));
      }
      if (map.getLayer("slide-traffic-route-case")) {
        map.setPaintProperty("slide-traffic-route-case", "line-color", next.case);
      }
      if (map.getLayer("slide-traffic-route")) {
        map.setPaintProperty("slide-traffic-route", "line-color", routeColor(next));
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
    // Brain first, so the copy below can use the number it committed.
    const why = !h.enabled() ? "off" : lastRouteTraffic ? "ok" : "failed";
    h.onRouteTraffic?.(h.enabled() ? lastRouteTraffic : null, lastMeasuredId || (route?.id ?? ""), why);
    const committed = h.committedDelaySec?.() ?? null;
    const shown = lastRouteTraffic && committed !== null ? { ...lastRouteTraffic, delaySec: committed } : lastRouteTraffic;
    const hit = route ? incidentAhead(items, route.coords, h.alongMi()) : null;
    const sum = trafficSummary({
      traffic: shown,
      ahead: hit?.item ?? null,
      aheadMi: hit?.mi ?? null,
      tomtom: configured,
      on: h.enabled(),
      alongMi: h.alongMi(),
    });
    h.onSummary(sum);
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
      const km = 18;
      const lists = await Promise.all([localIncidents(c.lat, c.lon, km)]);
      items = mergeMapIncidents(...lists);
      drawMarkers();

      if (configured && h.enabled() && route && route.coords.length > 1) {
        lastMeasuredId = route.id;
        const pts = sampleRoute(route.coords, 1.8, 12);
        const routed = await fetchTrafficRoute({ points: pts });
        if (routed) {
          lastRouteTraffic = routeTrafficFromRouting(routed);
        } else {
          const samples = await trafficAlong(sampleRoute(route.coords));
          lastRouteTraffic = routeTraffic(route.durationSec, route.distanceMi, samples);
        }
        setRouteData(route.coords);
      } else {
        lastRouteTraffic = null;
        lastMeasuredId = route?.id ?? "";
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
