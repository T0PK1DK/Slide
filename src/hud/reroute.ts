import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { decodePolyline6 } from "../lib/polyline";
import {
  considerReroute,
  emptyRerouteMemory,
  promptCopy,
  remainingCoords,
  rememberDismiss,
  rememberKeep,
  REROUTE,
  routeFingerprint,
  tomtomRouteTime,
  type AltCandidate,
  type IncidentLike,
  type LonLat,
  type RerouteFlags,
  type RerouteMemory,
  type RerouteOffer,
} from "../lib/reroute";
import type { SlideRoute } from "../lib/smooth";
import { viaLine } from "../lib/smooth";
import { tripShape } from "../lib/valhalla";

export type AltWithRoute = AltCandidate & { route: SlideRoute };

export type DriveSnap = {
  now: number;
  flags: RerouteFlags;
  remainingSec: number;
  currentLiveSec: number | null;
  currentCoords: Array<[number, number]>;
  alongMi: number;
  items: IncidentLike[];
  from: LonLat;
  dest: LonLat;
};

const emptyFc = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function whenStyle(map: MapLibreMap, fn: () => void): void {
  if (map.isStyleLoaded()) fn();
  else map.once("load", fn);
}

/**
 * Drive-bar faster-route card. Markup lives in shell.ts (`#reroute-card`).
 * Preview line is Valhalla geometry; © TomTom is on the card and the map
 * source because the live times that justify the prompt come from TomTom.
 */
export function mountReroute(opts: {
  map: MapLibreMap;
  getDrive: () => DriveSnap | null;
  findAlternatives: (from: LonLat) => Promise<AltWithRoute[]>;
  applyRoute: (route: SlideRoute) => void;
}): { tick(): void; reset(): void; hide(reason?: "keep" | "off"): void } {
  const card = $("reroute-card");
  const lineEl = $("rr-line");
  const takeBtn = $("rr-take") as HTMLButtonElement | null;
  const keepBtn = $("rr-keep") as HTMLButtonElement | null;

  let memory: RerouteMemory = emptyRerouteMemory();
  let pending: AltWithRoute | null = null;
  let offer: RerouteOffer | null = null;
  let busy = false;
  let hideTimer = 0;

  const setPreview = (coords: Array<[number, number]>) => {
    whenStyle(opts.map, () => {
      if (!opts.map.getSource("slide-reroute-preview")) {
        opts.map.addSource("slide-reroute-preview", {
          type: "geojson",
          data: emptyFc(),
          attribution: "© TomTom",
        });
        const css = getComputedStyle(document.documentElement);
        const color = css.getPropertyValue("--mint").trim() || css.getPropertyValue("--glow").trim() || "#7cf0d8";
        if (!opts.map.getLayer("slide-reroute-preview")) {
          opts.map.addLayer({
            id: "slide-reroute-preview",
            type: "line",
            source: "slide-reroute-preview",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": color,
              "line-width": 5,
              "line-opacity": 0.7,
              "line-dasharray": [1.4, 1.2],
            },
          });
        }
      }
      const src = opts.map.getSource("slide-reroute-preview") as { setData: (d: FeatureCollection) => void } | undefined;
      src?.setData(coords.length > 1
        ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] }
        : emptyFc());
    });
  };

  const hideCard = () => {
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = 0; }
    pending = null;
    offer = null;
    if (card) card.hidden = true;
    setPreview([]);
  };

  const showCard = (next: RerouteOffer, alt: AltWithRoute) => {
    pending = alt;
    offer = next;
    const copy = promptCopy(next.saveSec, next.why);
    if (lineEl) lineEl.textContent = copy.line;
    if (card) {
      card.hidden = false;
      card.setAttribute("aria-label", copy.line);
    }
    setPreview(alt.coords);
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (offer) memory = rememberDismiss(memory, Date.now());
      hideCard();
    }, REROUTE.PROMPT_MS);
  };

  const keep = () => {
    if (offer) memory = rememberKeep(memory, offer.fingerprint, Date.now());
    hideCard();
  };

  const take = () => {
    const route = pending?.route;
    hideCard();
    if (route) opts.applyRoute(route);
  };

  takeBtn?.addEventListener("click", take);
  keepBtn?.addEventListener("click", keep);

  const run = async () => {
    if (busy || document.hidden) return;
    const snap = opts.getDrive();
    if (!snap) { hideCard(); return; }
    if (card && !card.hidden) return;
    busy = true;
    try {
      const remaining = remainingCoords(snap.currentCoords, snap.alongMi);
      const currentFingerprint = routeFingerprint(snap.currentCoords);
      let alts: AltWithRoute[] = [];
      const result = await considerReroute({
        now: snap.now,
        flags: snap.flags,
        remainingSec: snap.remainingSec,
        currentLiveSec: snap.currentLiveSec,
        currentFingerprint,
        remainingLine: remaining,
        items: snap.items,
        memory,
        findAlternatives: async () => {
          alts = await opts.findAlternatives(snap.from);
          return alts;
        },
        timeFor: (alt) => tomtomRouteTime({ from: snap.from, dest: snap.dest, supporting: alt.coords }),
      });
      memory = result.memory;
      if (!result.offer) return;
      const match = alts.find((a) => a.fingerprint === result.offer!.fingerprint);
      if (!match) return;
      showCard(result.offer, match);
    } finally {
      busy = false;
    }
  };

  window.setInterval(() => { void run(); }, 15_000);

  return {
    tick() { void run(); },
    reset() {
      memory = emptyRerouteMemory(Date.now());
      hideCard();
    },
    hide(reason) {
      if (reason === "keep" && offer) memory = rememberKeep(memory, offer.fingerprint, Date.now());
      hideCard();
    },
  };
}

export function altsFromRanked(ranked: SlideRoute[], currentFingerprint: string): AltWithRoute[] {
  const out: AltWithRoute[] = [];
  for (const route of ranked) {
    const coords = decodePolyline6(tripShape(route.trip));
    const fingerprint = routeFingerprint(coords);
    if (!fingerprint || fingerprint === currentFingerprint) continue;
    out.push({
      fingerprint,
      coords,
      typicalSec: route.durationSec,
      via: viaLine(route.maneuvers),
      route,
    });
  }
  return out;
}
