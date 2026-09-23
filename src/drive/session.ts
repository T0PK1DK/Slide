import type { GeoJSONSource, Marker } from "maplibre-gl";
import type { Feature } from "geojson";
import { decodePolyline6 } from "../lib/polyline";
import { tripShape, type LonLat } from "../lib/valhalla";
import { arrivalClock, formatDuration, formatMiles, type SlideRoute } from "../lib/smooth";
import type { GarageConfig } from "../lib/garage";
import {
  buildSteps,
  formatShortDistance,
  maneuverArrow,
  nextMove,
  postedOutlook,
  type Step,
} from "../lib/guidance";
import { cumulativeMiles, snapToRoute, type Fix } from "../lib/tracking";
import { $ } from "../hud/dom";
import type { MapView } from "../map/mapview";

export type GhostEngine = typeof import("../lib/ghosts");

type MarkerCtor = { new (...args: ConstructorParameters<typeof Marker>): Marker };

export type DriveRefs = {
  mapView: MapView;
  maplibregl: { Marker: MarkerCtor };
  garage: () => GarageConfig;
  liveFix: () => Fix | null;
  followCamera: () => boolean;
  hudMode: () => "plan" | "review" | "drive";
};

export type DriveSession = {
  boot: (route: SlideRoute, loadGhosts: () => Promise<GhostEngine>) => Promise<void>;
  stop: () => void;
  restylePlayer: () => void;
  setGhostVisibility: (show: boolean) => void;
};

function carSvg(color: string, glow: string, ghost = false): string {
  const opacity = ghost ? 0.6 : 1;
  const id = `cg${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 44 72" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glow}" stop-opacity=".95"/><stop offset="1" stop-color="${color}" stop-opacity="${opacity}"/></linearGradient></defs><ellipse cx="22" cy="66" rx="12" ry="4.5" fill="${glow}" opacity=".4"/><path d="M13 58 L22 8 L31 58 Z" fill="url(#${id})" stroke="${glow}" stroke-width="1.8"/><path d="M17 32 L22 16 L27 32 Z" fill="#0b1218" opacity=".4"/><circle cx="16" cy="14" r="2.2" fill="#fff6c8"/><circle cx="28" cy="14" r="2.2" fill="#fff6c8"/></svg>`;
}

export function createDriveSession(refs: DriveRefs): DriveSession {
  let selectedCoords: [number, number][] = [];
  let ghosts: import("../lib/ghosts").GhostCar[] = [];
  let ghostMarkers: Marker[] = [];
  let playerMarker: Marker | null = null;
  let chaseT = 0;
  let raf = 0;
  let lastTs = 0;
  let steps: Step[] = [];
  let cumulative: number[] = [];
  let progressMi = 0;
  let selected: SlideRoute | null = null;
  let ghostEngine: GhostEngine | null = null;

  const spawnPlayer = () => {
    playerMarker?.remove();
    const el = document.createElement("div");
    el.className = "car-marker";
    const g = refs.garage();
    el.innerHTML = carSvg(g.carColor, g.glow);
    playerMarker = new refs.maplibregl.Marker({
      element: el, anchor: "center", pitchAlignment: "map", rotationAlignment: "map",
    }).setLngLat(selectedCoords[0]).addTo(refs.mapView.map);
  };

  const spawnGhosts = () => {
    ghostMarkers.forEach((m) => m.remove());
    ghostMarkers = [];
    ghosts = [];
    if (!ghostEngine) return;
    const g = refs.garage();
    ghosts = g.showGhosts ? ghostEngine.seedGhosts(selectedCoords, g.tag) : [];
    if (!g.shareGhost) ghosts = ghosts.filter((x) => x.tag !== g.tag.slice(0, 8));
    $("#stat-ghosts").textContent = String(ghosts.length);
    const trails: Feature[] = [];
    for (const ghost of ghosts) {
      const el = document.createElement("div");
      el.className = "ghost-marker";
      el.style.color = ghost.color;
      el.innerHTML = `<div class="ghost-label">${ghost.tag}</div>${carSvg(ghost.color, ghost.color, true)}`;
      ghostMarkers.push(
        new refs.maplibregl.Marker({
          element: el, anchor: "center", pitchAlignment: "map", rotationAlignment: "map",
        }).setLngLat([ghost.samples[0].lon, ghost.samples[0].lat]).addTo(refs.mapView.map)
      );
      trails.push({
        type: "Feature",
        properties: { color: ghost.color },
        geometry: { type: "LineString", coordinates: ghost.samples.map((s) => [s.lon, s.lat]) },
      });
    }
    refs.mapView.whenStyleReady(() => {
      refs.mapView.addRouteLayers();
      (refs.mapView.map.getSource("ghost-trails") as GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: refs.garage().showGhosts ? trails : [],
      });
    });
  };

  const setOffRoute = (off: boolean) => {
    $("#maneuver").classList.toggle("off-route", off);
  };

  const renderGuidance = (mi: number, mph: number) => {
    const route = selected;
    const maneuverEl = $("#maneuver");
    const postedEl = $("#posted");
    if (!route || !steps.length) {
      maneuverEl.setAttribute("hidden", "");
      postedEl.setAttribute("hidden", "");
      return;
    }
    const move = nextMove(steps, mi);
    if (move) {
      maneuverEl.removeAttribute("hidden");
      $("#man-arrow").setAttribute("d", maneuverArrow(move.type));
      $("#man-dist").textContent = formatShortDistance(move.distanceMi);
      $("#man-instr").textContent = move.instruction;
      $("#man-fill").style.width = `${Math.round(move.proximity * 100)}%`;
      maneuverEl.classList.toggle("imminent", move.distanceMi < 0.08);
    } else {
      maneuverEl.setAttribute("hidden", "");
    }

    const outlook = postedOutlook(route.bands, mi);
    const limitEl = $("#limit");
    if (outlook?.currentMph) {
      limitEl.removeAttribute("hidden");
      $("#limit-n").textContent = String(outlook.currentMph);
      limitEl.classList.toggle("over", mph > outlook.currentMph + 2);
    } else {
      limitEl.setAttribute("hidden", "");
    }

    if (outlook && outlook.nextMph && outlook.changeInMi != null && outlook.changeInMi < 1.2) {
      postedEl.removeAttribute("hidden");
      postedEl.classList.toggle("drop", outlook.dropping);
      postedEl.textContent = outlook.currentMph
        ? `Hold ${outlook.currentMph} → ${outlook.nextMph} in ${formatShortDistance(outlook.changeInMi)}`
        : `${outlook.nextMph} in ${formatShortDistance(outlook.changeInMi)}`;
    } else {
      postedEl.setAttribute("hidden", "");
    }
  };

  const updateDriveMeta = (route: SlideRoute | undefined, mi: number) => {
    if (refs.hudMode() !== "drive" || !route) return;
    const remainMi = Math.max(0, route.distanceMi - mi);
    const remainSec = route.durationSec * (remainMi / Math.max(route.distanceMi, 0.01));
    $("#drive-eta").textContent = formatDuration(remainSec);
    $("#drive-remain").textContent = `${formatMiles(remainMi)} · ${arrivalClock(remainSec)}`;
  };

  const tick = (ts: number) => {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!selectedCoords.length) { raf = requestAnimationFrame(tick); return; }

    const route = selected;
    const totalMi = cumulative[cumulative.length - 1] || route?.distanceMi || 0;
    let you: { pos: LonLat; bearing: number };
    let mph: number;
    const liveFix = refs.liveFix();
    const live = Boolean(liveFix);

    if (liveFix) {
      const snap = snapToRoute(selectedCoords, cumulative, liveFix.pos);
      if (snap) {
        progressMi = snap.alongMi;
        you = { pos: snap.snapped, bearing: liveFix.headingDeg ?? snap.bearing };
        setOffRoute(snap.offRouteM > 60);
      } else {
        you = { pos: liveFix.pos, bearing: liveFix.headingDeg ?? 0 };
      }
      mph = Math.round(liveFix.speedMph);
    } else if (ghostEngine) {
      chaseT = (chaseT + dt * 0.015) % 1;
      you = ghostEngine.chasePoint(selectedCoords, chaseT);
      progressMi = chaseT * totalMi;
      mph = route ? Math.round(route.distanceMi / Math.max(route.durationSec / 3600, 0.01)) : 0;
    } else {
      you = { pos: { lon: selectedCoords[0][0], lat: selectedCoords[0][1] }, bearing: 0 };
      mph = 0;
    }

    playerMarker?.setLngLat([you.pos.lon, you.pos.lat]);
    playerMarker?.setRotation(you.bearing);
    $("#speed-n").textContent = String(mph);
    $("#speed-src").textContent = live ? "MPH" : "Est";
    if (refs.garage().camera === "chase" && refs.followCamera()) {
      refs.mapView.map.jumpTo({ center: [you.pos.lon, you.pos.lat], bearing: you.bearing, pitch: 64, zoom: 16.4 });
    }

    renderGuidance(progressMi, mph);
    updateDriveMeta(route ?? undefined, progressMi);

    if (ghostEngine) {
      ghosts.forEach((g, i) => {
        const s = ghostEngine!.stepGhost(g, dt);
        ghostMarkers[i]?.setLngLat([s.lon, s.lat]);
        ghostMarkers[i]?.setRotation(s.bearing);
      });
    }
    if (ghosts.length) {
      const selfT = totalMi > 0 ? Math.min(1, progressMi / totalMi) : chaseT;
      const wrapped = ((ghosts[0].t - selfT + 0.5) % 1 + 1) % 1 - 0.5;
      const lead = (wrapped * (route?.durationSec ?? 0)).toFixed(1);
      $("#ghost-delta").textContent = `GHOST ${Number(lead) >= 0 ? "+" : ""}${lead}s`;
    } else {
      $("#ghost-delta").textContent = "NO GHOSTS";
    }
    raf = requestAnimationFrame(tick);
  };

  return {
    async boot(route, loadGhosts) {
      selected = route;
      selectedCoords = decodePolyline6(tripShape(route.trip));
      if (!selectedCoords.length) return;
      cumulative = cumulativeMiles(selectedCoords);
      steps = buildSteps(route.maneuvers);
      progressMi = 0;
      chaseT = 0;
      spawnPlayer();
      $("#speedo").removeAttribute("hidden");
      if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(tick); }
      void loadGhosts().then((mod) => {
        ghostEngine = mod;
        spawnGhosts();
      });
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      playerMarker?.remove();
      playerMarker = null;
      ghostMarkers.forEach((m) => m.remove());
      ghostMarkers = [];
      ghosts = [];
      ghostEngine = null;
    },
    restylePlayer() {
      if (!playerMarker) return;
      const g = refs.garage();
      playerMarker.getElement().innerHTML = carSvg(g.carColor, g.glow);
    },
    setGhostVisibility(show) {
      ghostMarkers.forEach((m) => { m.getElement().style.display = show ? "block" : "none"; });
    },
  };
}

export function routePaintFeatures(routes: SlideRoute[], selectedId: string) {
  return routes.map((r) => ({
    type: "Feature" as const,
    properties: { id: r.id, selected: r.id === selectedId },
    geometry: { type: "LineString" as const, coordinates: decodePolyline6(r.trip.legs.map((l) => l.shape).join("")) },
  }));
}
