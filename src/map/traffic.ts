import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { ago } from "../lib/reports";
import type { RadarItem } from "../lib/reports";
import {
  CONGESTION_COLOR,
  coloredRoutePieces,
  fetchRouteTraffic,
  loadMapIncidents,
  reviewTrafficNote,
  TRAFFIC_FLOW_TILES,
  trafficDelayLabel,
  trafficStatus,
  type RouteTraffic,
} from "../lib/traffic";
import { dedupeIncidents, incidentCard, isIncidentIconKind } from "../lib/sources/tomtom";
import { incidentMarkerHtml } from "./incident-icons";

export type TrafficHooks = {
  showLayer: () => boolean;
  onDelay: (label: string | null, note: string) => void;
};

export type TrafficCtl = {
  attach(): void;
  setEnabled(on: boolean): void;
  setCenter(lat: number, lon: number): void;
  setRoute(coords: [number, number][] | null): void;
  refresh(): void;
  lastDelay(): string | null;
};

const FLOW_SRC = "traffic-flow";
const FLOW_LAYER = "traffic-flow";
const ROUTE_SRC = "traffic-route";
const ROUTE_LAYER = "traffic-route";
const POLL_MS = 60_000;

function emptyFc(): FeatureCollection<LineString> {
  return { type: "FeatureCollection", features: [] };
}

export function mountTraffic(map: MapLibreMap, h: TrafficHooks): TrafficCtl {
  let configured = false;
  let enabled = h.showLayer();
  let center: { lat: number; lon: number } | null = null;
  let route: [number, number][] | null = null;
  let info: RouteTraffic | null = null;
  let markers: Marker[] = [];
  let lastPoll = 0;
  let polling = false;
  let attached = false;
  const card = document.getElementById("incident-card");

  const hideCard = () => {
    if (card) card.hidden = true;
  };

  const showCard = (item: RadarItem) => {
    if (!card) return;
    const c = incidentCard(item);
    const ico = card.querySelector("#inc-ico");
    if (ico) ico.innerHTML = incidentMarkerHtml(item.kind);
    const type = card.querySelector("#inc-type");
    const road = card.querySelector("#inc-road");
    const meta = card.querySelector("#inc-meta");
    if (type) type.textContent = c.type;
    if (road) road.textContent = c.road;
    if (meta) meta.textContent = [c.delay, c.when || ago(item.createdAt)].filter(Boolean).join(" · ");
    card.hidden = false;
  };

  const pushDelay = () => {
    const label = enabled && configured ? trafficDelayLabel(info) : null;
    h.onDelay(label, reviewTrafficNote(enabled && configured ? info : null));
  };

  const flowVisible = () => configured && enabled;

  const applyFlowVisibility = () => {
    if (!map.getLayer(FLOW_LAYER)) return;
    map.setLayoutProperty(FLOW_LAYER, "visibility", flowVisible() ? "visible" : "none");
  };

  const ensureLayers = () => {
    if (map.getSource(FLOW_SRC)) {
      applyFlowVisibility();
    } else if (configured) {
      map.addSource(FLOW_SRC, {
        type: "raster",
        tiles: [TRAFFIC_FLOW_TILES],
        tileSize: 256,
        minzoom: 6,
        maxzoom: 16,
        attribution: "© TomTom",
      });
      const before = map.getLayer("route-glow") ? "route-glow" : undefined;
      map.addLayer(
        {
          id: FLOW_LAYER,
          type: "raster",
          source: FLOW_SRC,
          paint: { "raster-opacity": 0.72, "raster-fade-duration": 200 },
        },
        before,
      );
      applyFlowVisibility();
    }
    if (!map.getSource(ROUTE_SRC)) {
      map.addSource(ROUTE_SRC, { type: "geojson", data: emptyFc() });
      const before = map.getLayer("route-core") ? "route-core" : map.getLayer("route-line") ? "route-line" : undefined;
      map.addLayer(
        {
          id: ROUTE_LAYER,
          type: "line",
          source: ROUTE_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["match", ["get", "congestion"], "free", CONGESTION_COLOR.free, "slow", CONGESTION_COLOR.slow, "heavy", CONGESTION_COLOR.heavy, CONGESTION_COLOR.standstill],
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 7],
            "line-opacity": 0.92,
          },
        },
        before,
      );
    }
    paintRoute();
  };

  const paintRoute = () => {
    const src = map.getSource(ROUTE_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!enabled || !configured || !route || !info?.samples.length) {
      src.setData(emptyFc());
      return;
    }
    const pieces = coloredRoutePieces(route, info.samples);
    const features: Feature<LineString>[] = pieces
      .filter((p) => p.coordinates.length >= 2)
      .map((p) => ({
        type: "Feature",
        properties: { congestion: p.congestion },
        geometry: { type: "LineString", coordinates: p.coordinates },
      }));
    src.setData({ type: "FeatureCollection", features });
  };

  const clearMarkers = () => {
    markers.forEach((m) => m.remove());
    markers = [];
  };

  const drawIncidents = (items: RadarItem[]) => {
    clearMarkers();
    const shown = dedupeIncidents(items).filter((it) => isIncidentIconKind(it.kind)).slice(0, 80);
    for (const it of shown) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "inc-pin";
      el.innerHTML = incidentMarkerHtml(it.kind);
      el.setAttribute("aria-label", `${it.title}`);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showCard(it);
      });
      markers.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([it.lon, it.lat]).addTo(map));
    }
  };

  const poll = async () => {
    if (polling || !center) return;
    polling = true;
    lastPoll = Date.now();
    try {
      const items = await loadMapIncidents(center.lat, center.lon);
      drawIncidents(items);
    } finally {
      polling = false;
    }
  };

  const pollRoute = async () => {
    if (!configured || !enabled || !route || route.length < 2) {
      info = configured ? { configured: true, delaySec: null, samples: [] } : null;
      paintRoute();
      pushDelay();
      return;
    }
    info = await fetchRouteTraffic(route);
    paintRoute();
    pushDelay();
  };

  const attach = () => {
    if (attached) {
      ensureLayers();
      return;
    }
    attached = true;
    void trafficStatus().then((s) => {
      configured = s.configured;
      ensureLayers();
      pushDelay();
      if (center) void poll();
      if (route) void pollRoute();
    });
    map.on("click", hideCard);
    card?.querySelector("#inc-close")?.addEventListener("click", hideCard);
  };

  return {
    attach,
    setEnabled(on) {
      enabled = on;
      applyFlowVisibility();
      void pollRoute();
      if (!on) hideCard();
    },
    setCenter(lat, lon) {
      const moved = !center || Math.hypot(lat - center.lat, lon - center.lon) > 0.008;
      center = { lat, lon };
      if (moved || Date.now() - lastPoll > POLL_MS) void poll();
    },
    setRoute(coords) {
      route = coords && coords.length >= 2 ? coords : null;
      void pollRoute();
    },
    refresh() {
      lastPoll = 0;
      if (center) void poll();
      void pollRoute();
    },
    lastDelay() {
      return enabled && configured ? trafficDelayLabel(info) : null;
    },
  };
}
