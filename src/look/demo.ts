import maplibregl from "maplibre-gl";
import { mountPlaceCard, shouldOpenPlaceCard } from "../hud/place-card";
import { liftNightBasemap } from "../lib/maplook";
import { mountGhostCars } from "../map/ghost-car";
import { registerSlideModels } from "../models";
import { mountStorePins } from "../map/store-pins";
import { LOOK_FIXTURES, placeFor } from "./fixtures";
import "./look.css";
import type { Store } from "./types";

registerSlideModels();

export type LookTheme = "night" | "day";

type SlideLookApi = {
  showPlace: (id: string) => void;
  showLoading: (id: string) => void;
  setLook: (look: LookTheme) => void;
  trigger: (kind: "stopped" | "destination" | "close") => void;
  zoom: (z: number) => void;
  showSkel: (on: boolean) => void;
  ready: boolean;
};

declare global {
  interface Window {
    slideLook?: SlideLookApi;
  }
}

const params = new URLSearchParams(location.search);
const initialLook: LookTheme = params.get("look") === "day" || params.get("demo") === "day" ? "day" : "night";

const STYLE: Record<LookTheme, string> = {
  night: "https://tiles.openfreemap.org/styles/dark",
  day: "https://tiles.openfreemap.org/styles/positron",
};

const CENTER: [number, number] = [-80.1372, 26.1224];

function applyTheme(look: LookTheme) {
  document.documentElement.dataset.look = look;
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-look-btn]")) {
    btn.classList.toggle("on", btn.dataset.lookBtn === look);
  }
}

applyTheme(initialLook);

const map = new maplibregl.Map({
  container: "map",
  style: STYLE[initialLook],
  center: CENTER,
  zoom: 14.2,
  pitch: 42,
  bearing: -12,
  attributionControl: false,
  hash: false,
});

const hud = document.getElementById("look-hud")!;
const status = document.getElementById("look-status")!;

const skel = document.createElement("div");
skel.className = "look-skel-pins";
skel.hidden = true;
skel.setAttribute("aria-hidden", "true");
skel.innerHTML = [
  ["38%", "42%"],
  ["58%", "36%"],
  ["46%", "58%"],
  ["64%", "52%"],
]
  .map(([l, t], i) => `<i class="look-skel-pin" style="left:${l};top:${t};animation-delay:${i * 0.16}s"></i>`)
  .join("");
hud.appendChild(skel);

const card = mountPlaceCard({
  host: hud,
  onClose: () => {
    pins.select(null);
    status.textContent = "Fixtures · not live OSM";
  },
  onDirections: (store) => {
    status.textContent = `Directions · ${store.name ?? "place"}`;
  },
});

const pins = mountStorePins({
  map,
  onSelect: (store) => openStore(store, "pin"),
});

const ghosts = mountGhostCars(map);

function openStore(store: Store, trigger: "pin" | "stopped" | "destination") {
  if (!shouldOpenPlaceCard({ trigger, moving: false })) return;
  pins.select(store.id ?? null);
  card.show(store, placeFor(store));
  const at = store.lon && store.lat ? ([store.lon, store.lat] as [number, number]) : CENTER;
  map.easeTo({ center: at, zoom: Math.max(map.getZoom(), 15.2), duration: 450 });
  status.textContent = trigger === "destination" ? "At destination" : trigger === "stopped" ? "Stopped" : store.name ?? "Place";
}

function storeById(id: string): Store | undefined {
  return LOOK_FIXTURES.stores.find((s) => s.id === id);
}

function nearestStore(): Store | undefined {
  return LOOK_FIXTURES.stores[0];
}

const api: SlideLookApi = {
  ready: false,
  showPlace(id) {
    const store = storeById(id);
    if (store) openStore(store, "pin");
  },
  showLoading(id) {
    const store = storeById(id) ?? LOOK_FIXTURES.stores[0];
    if (!store) return;
    pins.select(store.id ?? null);
    card.show(store, undefined, { loading: true });
    status.textContent = "Looking up this place…";
  },
  showSkel(on) {
    skel.hidden = !on;
    pins.setVisible(!on);
    status.textContent = on ? "Looking for stores…" : "Fixtures · not live OSM";
  },
  setLook(look) {
    const next = new URL(location.href);
    next.searchParams.set("look", look);
    location.replace(next.toString());
  },
  zoom(z) {
    map.jumpTo({ zoom: z, center: CENTER });
  },
  trigger(kind) {
    if (kind === "close") {
      card.hide();
      pins.select(null);
      return;
    }
    if (kind === "destination") {
      const dest = storeById(LOOK_FIXTURES.destinationId) ?? nearestStore();
      if (dest) openStore(dest, "destination");
      return;
    }
    const store = pins.storeById(pins.selected() ?? "") ?? nearestStore();
    if (store) openStore(store, "stopped");
  },
};

window.slideLook = api;

map.on("load", () => {
  if (initialLook === "night") liftNightBasemap(map, "night");
  pins.setStores(LOOK_FIXTURES.stores);
  ghosts.setGhosts(LOOK_FIXTURES.ghosts);
  api.ready = true;
  document.documentElement.dataset.lookReady = "1";
  const openId = params.get("place");
  if (openId) api.showPlace(openId);
  if (params.get("empty") === "1") api.showPlace("osm:node/corner-1");
  if (params.get("loading") === "1") api.showLoading(params.get("place") || "osm:node/123");
  if (params.get("skel") === "1") api.showSkel(true);
});

map.on("error", () => {
  // Style/tile misses should not block the HUD; pins still bind on load.
  if (!api.ready) {
    api.ready = true;
    document.documentElement.dataset.lookReady = "1";
  }
});

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-look-btn]")) {
  btn.addEventListener("click", () => {
    const look = btn.dataset.lookBtn === "day" ? "day" : "night";
    if (look !== initialLook) api.setLook(look);
  });
}

document.getElementById("look-triggers")?.addEventListener("click", (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-trigger]");
  if (!t?.dataset.trigger) return;
  const kind = t.dataset.trigger;
  if (kind === "stopped" || kind === "destination" || kind === "close") api.trigger(kind);
});
