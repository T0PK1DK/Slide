import maplibregl from "maplibre-gl";
import { vehicleSvg } from "../lib/vehicles";
import { ghostLngLat, ghostName, type Ghost } from "../look/types";

export type GhostCarsHandle = {
  setGhosts(ghosts: Ghost[]): void;
  destroy(): void;
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function ghostCarHtml(ghost: Ghost): string {
  const name = ghostName(ghost);
  const color = ghost.color && /^#([0-9a-fA-F]{6})$/.test(ghost.color) ? ghost.color : "#f0a04b";
  const heading = Number.isFinite(ghost.headingDeg) ? ghost.headingDeg! : 0;
  const svg = vehicleSvg({
    model: ghost.carModelKey || "classic",
    paint: color,
    accent: color,
    livery: "solid",
    ghost: true,
  });
  const tag = name
    ? `<span class="look-ghost-tag">${esc(name)}</span>`
    : `<span class="look-ghost-tag is-empty">Friend</span>`;
  return `${tag}
<div class="look-ghost-body" style="--ghost-color:${esc(color)};transform:rotate(${heading}deg)">
  <i class="look-ghost-arrow" aria-hidden="true"></i>
  <span class="look-ghost-car">${svg}</span>
</div>`;
}

export function mountGhostCars(map: maplibregl.Map): GhostCarsHandle {
  let markers: maplibregl.Marker[] = [];

  const clear = () => {
    for (const m of markers) m.remove();
    markers = [];
  };

  return {
    setGhosts(ghosts) {
      clear();
      for (const g of ghosts) {
        const lngLat = ghostLngLat(g);
        if (!lngLat) continue;
        const el = document.createElement("div");
        el.className = "look-ghost";
        const label = ghostName(g) ?? "Friend";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", `${label} on the map`);
        el.innerHTML = ghostCarHtml(g);
        markers.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).addTo(map));
      }
    },
    destroy: clear,
  };
}
