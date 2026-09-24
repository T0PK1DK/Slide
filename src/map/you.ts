import maplibregl from "maplibre-gl";
import type { Fix } from "../lib/tracking";

/**
 * The driver's own position on the map: a white core with a glow ring and two
 * slow pulse rings (SEKAI reference), a heading cone when the phone knows which
 * way it's moving, and an accuracy halo sized in real metres. Shown whenever
 * location is on, in Plan and Explore. Drive mode hides it because the 3D car
 * takes over the same spot.
 */
export type YouMarker = {
  update(fix: Fix): void;
  setVisible(on: boolean): void;
  remove(): void;
};

const STALE_MS = 15_000;

export function createYouMarker(map: maplibregl.Map): YouMarker {
  const el = document.createElement("div");
  el.className = "you";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Your location");
  el.innerHTML = `
    <span class="you-acc"></span>
    <span class="you-pulse"></span>
    <span class="you-pulse you-pulse-2"></span>
    <span class="you-cone" hidden></span>
    <span class="you-dot"></span>`;
  const acc = el.querySelector<HTMLElement>(".you-acc")!;
  const cone = el.querySelector<HTMLElement>(".you-cone")!;

  const marker = new maplibregl.Marker({ element: el, anchor: "center", rotationAlignment: "map", pitchAlignment: "map" });
  let added = false;
  let lastFix: Fix | null = null;
  let staleTimer = 0;

  const sizeAccuracy = () => {
    if (!lastFix) return;
    // Metres → pixels at this latitude and zoom, clamped so a bad fix can't flood the screen.
    const mpp = (156543.03392 * Math.cos((lastFix.pos.lat * Math.PI) / 180)) / 2 ** map.getZoom();
    const px = Math.max(28, Math.min(220, (lastFix.accuracyM / mpp) * 2));
    acc.style.width = acc.style.height = `${px}px`;
  };
  map.on("zoom", sizeAccuracy);

  return {
    update(fix) {
      lastFix = fix;
      marker.setLngLat([fix.pos.lon, fix.pos.lat]);
      if (!added) { marker.addTo(map); added = true; }
      const moving = fix.headingDeg !== null && fix.speedMph > 2;
      cone.hidden = !moving;
      if (moving) marker.setRotation(fix.headingDeg!);
      el.classList.remove("stale");
      window.clearTimeout(staleTimer);
      staleTimer = window.setTimeout(() => el.classList.add("stale"), STALE_MS);
      sizeAccuracy();
    },
    setVisible(on) {
      el.style.display = on ? "" : "none";
    },
    remove() {
      window.clearTimeout(staleTimer);
      map.off("zoom", sizeAccuracy);
      marker.remove();
      added = false;
    },
  };
}
