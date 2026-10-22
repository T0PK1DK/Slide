/**
 * Live look on the real HUD. Pins, place card, hologram slot talk to Nard's
 * `/api/stores` + `/api/places`. Ghost cars follow `watchLiveGhosts` when
 * accounts are on. Fixtures stay on `/look.html` and in tests.
 */
import maplibregl from "maplibre-gl";
import { mountPlaceCard, shouldOpenPlaceCard } from "../hud/place-card";
import { cloudConfigured } from "../lib/cloud";
import { watchLiveGhosts, type GhostWatch } from "../lib/live-ghosts/client";
import type { Ghost as LiveGhost } from "../lib/live-ghosts/types";
import type { PlaceInfo } from "../lib/place-info";
import type { Store } from "../lib/stores";
import { STORE_LAYER_CLUSTERS, STORE_LAYER_PINS, STORE_LAYER_SELECTED, mountStorePins } from "../map/store-pins";
import { mountGhostCars } from "../map/ghost-car";
import { registerSlideModels } from "../models";
import {
  MOVE_DEBOUNCE_MS,
  createStoreFeed,
  debounce,
  lookStatusFor,
  mapBbox,
  nearestStore,
  shouldLoadStores,
  storesInBbox,
} from "./store-feed";
import "./live.css";

export type LookLiveHooks = {
  map: maplibregl.Map;
  host: HTMLElement;
  getMode: () => string;
  dest: () => { lat: number; lon: number } | null;
  showGhosts: () => boolean;
  onDirections?: (store: Store) => void;
};

export type LookLiveHandle = {
  setMode(mode: string): void;
  setGhostsVisible(on: boolean): void;
  refresh(force?: boolean): void;
  hideCard(): void;
  notifyDest(): void;
  storeNear(lat: number, lon: number, maxM?: number): Store | undefined;
  extrasFor(lat: number, lon: number, maxM?: number): Promise<{ store: Store; info?: PlaceInfo } | null>;
  destroy(): void;
};

export type SlideLookLiveApi = {
  ready: boolean;
  stores(): Store[];
  status(): string;
  statusKind(): string | null;
  showStore(id: string): Promise<void>;
  flyTo(lon: number, lat: number, zoom?: number): void;
  refresh(): void;
  extrasFor(lat: number, lon: number, maxM?: number): Promise<{ store: Store; info?: PlaceInfo } | null>;
};

declare global {
  interface Window {
    slideLookLive?: SlideLookLiveApi;
  }
}

const SKEL_SPOTS: Array<[string, string]> = [
  ["38%", "42%"],
  ["58%", "36%"],
  ["46%", "58%"],
  ["64%", "52%"],
];

export function mountLookLive(hooks: LookLiveHooks): LookLiveHandle {
  registerSlideModels();

  const map = hooks.map;
  const feed = createStoreFeed();
  const schedule = debounce(MOVE_DEBOUNCE_MS);

  const status = document.createElement("button");
  status.type = "button";
  status.className = "look-live-status panel";
  status.hidden = true;
  hooks.host.appendChild(status);

  const skel = document.createElement("div");
  skel.className = "look-skel-pins";
  skel.hidden = true;
  skel.setAttribute("aria-hidden", "true");
  skel.innerHTML = SKEL_SPOTS.map(
    ([l, t], i) => `<i class="look-skel-pin" style="left:${l};top:${t};animation-delay:${i * 0.16}s"></i>`,
  ).join("");
  hooks.host.appendChild(skel);

  let lastStores: Store[] = [];
  let loading = false;
  let lastError: string | undefined;
  let gen = 0;
  let destOpenedFor: string | null = null;
  let ghostWatch: GhostWatch | null = null;
  let ghostRows: LiveGhost[] = [];

  const card = mountPlaceCard({
    host: hooks.host,
    onClose: () => pins.select(null),
    onDirections: (store) => {
      if (!Number.isFinite(store.lat) || !Number.isFinite(store.lon) || !store.id) return;
      const live = lastStores.find((s) => s.id === store.id);
      if (live) hooks.onDirections?.(live);
    },
  });

  const pins = mountStorePins({
    map,
    onSelect: (store) => {
      const live = lastStores.find((s) => s.id === store.id);
      if (live) void openStore(live, "pin");
    },
  });

  const ghosts = mountGhostCars(map);

  const hiddenByMode = () => {
    const mode = hooks.getMode();
    return mode === "drive" || mode === "arrive";
  };

  const paintStatus = () => {
    if (hiddenByMode()) {
      status.hidden = true;
      return;
    }
    const next = lookStatusFor({
      zoom: map.getZoom(),
      loading,
      error: lastError,
      count: lastStores.length,
    });
    if (!next.kind) {
      status.hidden = true;
      status.textContent = "";
      status.dataset.kind = "";
      return;
    }
    status.hidden = false;
    status.textContent = next.text;
    status.dataset.kind = next.kind;
    status.setAttribute("aria-live", next.kind === "loading" ? "polite" : "off");
  };

  const showSkel = (on: boolean) => {
    skel.hidden = hiddenByMode() || !on;
  };

  const applyGhosts = () => {
    if (hiddenByMode() || !hooks.showGhosts()) {
      ghosts.setGhosts([]);
      return;
    }
    ghosts.setGhosts(ghostRows);
  };

  async function openStore(store: Store, trigger: "pin" | "stopped" | "destination") {
    if (!shouldOpenPlaceCard({ trigger, moving: false })) return;
    document.getElementById("place-card")?.setAttribute("hidden", "");
    destOpenedFor = `${store.lat.toFixed(5)},${store.lon.toFixed(5)}`;
    pins.select(store.id);
    card.show(store, undefined, { loading: true });
    try {
      const info = await feed.loadPlace(store);
      if (pins.selected() !== store.id) return;
      card.show(store, info);
    } catch {
      if (pins.selected() !== store.id) return;
      card.show(store);
    }
  }

  function considerDestination() {
    if (hiddenByMode()) return;
    const d = hooks.dest();
    if (!d) return;
    const searchCard = document.getElementById("place-card");
    if (searchCard && !searchCard.hasAttribute("hidden")) return;
    const key = `${d.lat.toFixed(5)},${d.lon.toFixed(5)}`;
    if (destOpenedFor === key) return;
    const hit = nearestStore(lastStores, d.lat, d.lon, 90);
    if (!hit) return;
    destOpenedFor = key;
    void openStore(hit, "destination");
  }

  async function refresh() {
    if (hiddenByMode()) {
      pins.setVisible(false);
      showSkel(false);
      loading = false;
      paintStatus();
      return;
    }
    const zoom = map.getZoom();
    if (!shouldLoadStores(zoom)) {
      pins.setVisible(false);
      lastStores = [];
      loading = false;
      lastError = undefined;
      showSkel(false);
      paintStatus();
      return;
    }
    pins.setVisible(true);
    let box: ReturnType<typeof mapBbox>;
    try {
      box = mapBbox(map.getBounds());
    } catch {
      return;
    }
    const my = ++gen;
    const cached = storesInBbox(feed.peek(), box);
    lastStores = cached;
    if (cached.length) {
      pins.setStores(cached);
      showSkel(false);
    } else {
      showSkel(true);
    }
    loading = true;
    lastError = undefined;
    paintStatus();
    const snap = await feed.loadBbox(box);
    if (my !== gen) return;
    loading = false;
    if (snap.aborted) {
      paintStatus();
      return;
    }
    lastStores = snap.stores;
    lastError = snap.error;
    pins.setStores(snap.stores);
    showSkel(false);
    paintStatus();
    considerDestination();
    api.ready = true;
  }

  status.addEventListener("click", () => {
    if (status.dataset.kind !== "error") return;
    void refresh();
  });

  const onMove = () => schedule(() => void refresh());
  map.on("moveend", onMove);
  map.on("zoomend", onMove);

  map.on("click", (e) => {
    if (!card.isOpen()) return;
    const layers = [STORE_LAYER_PINS, STORE_LAYER_SELECTED, STORE_LAYER_CLUSTERS].filter((id) => map.getLayer(id));
    if (!layers.length) return;
    const hit = map.queryRenderedFeatures(e.point, { layers });
    if (hit.length) return;
    card.hide();
    pins.select(null);
  });

  if (cloudConfigured()) {
    ghostWatch = watchLiveGhosts((rows) => {
      ghostRows = rows;
      applyGhosts();
    });
  }

  const storeNear = (lat: number, lon: number, maxM = 90) =>
    nearestStore(lastStores, lat, lon, maxM) ?? nearestStore(feed.peek(), lat, lon, maxM);

  const extrasFor = async (lat: number, lon: number, maxM = 90) => {
    const store = storeNear(lat, lon, maxM);
    if (!store) return null;
    try {
      return { store, info: await feed.loadPlace(store) };
    } catch {
      return { store };
    }
  };

  const api: SlideLookLiveApi = {
    ready: false,
    stores: () => lastStores,
    status: () => status.textContent ?? "",
    statusKind: () => (status.hidden ? null : status.dataset.kind ?? null),
    async showStore(id) {
      const store = lastStores.find((s) => s.id === id) ?? feed.peek().find((s) => s.id === id);
      if (store) await openStore(store, "pin");
    },
    flyTo(lon, lat, zoom = 14.4) {
      map.jumpTo({ center: [lon, lat], zoom });
      void refresh();
    },
    refresh: () => void refresh(),
    extrasFor,
  };
  window.slideLookLive = api;

  if (map.loaded()) void refresh();
  else map.once("load", () => void refresh());

  return {
    setMode() {
      applyGhosts();
      if (hiddenByMode()) {
        card.hide();
        pins.select(null);
        pins.setVisible(false);
        showSkel(false);
        status.hidden = true;
        return;
      }
      void refresh();
    },
    setGhostsVisible() {
      applyGhosts();
    },
    refresh: () => void refresh(),
    hideCard() {
      card.hide();
      pins.select(null);
    },
    notifyDest() {
      destOpenedFor = null;
      considerDestination();
    },
    storeNear,
    extrasFor,
    destroy() {
      gen += 1;
      ghostWatch?.stop();
      map.off("moveend", onMove);
      map.off("zoomend", onMove);
      card.destroy();
      pins.destroy();
      ghosts.destroy();
      status.remove();
      skel.remove();
      if (window.slideLookLive === api) delete window.slideLookLive;
    },
  };
}
