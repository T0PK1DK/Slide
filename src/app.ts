import type { FeatureCollection } from "geojson";
import { decodePolyline6 } from "./lib/polyline";
import { tripShape, type LonLat, type SearchHit } from "./lib/valhalla";
import {
  arrivalClock,
  formatDuration,
  formatMiles,
  viaLine,
  type SlideRoute,
} from "./lib/smooth";
import { asSavedPlace, loadGarage, saveGarage, TRAILS, type GarageConfig } from "./lib/garage";
import { startTracking, type Fix, type TrackerHandle } from "./lib/tracking";
import { $, applyTheme, esc, setStatus, showCoach, showError, showNetBanner, type HudMode } from "./hud/dom";
import { bindSearch } from "./plan/search";
import { planErrorMessage, planRoutes } from "./plan/route";
import { createDriveSession, routePaintFeatures } from "./drive/session";
import { createMapView, type MapView } from "./map/mapview";
import { NetError } from "./lib/net";

const MIAMI: LonLat = { lon: -80.1918, lat: 25.7617 };

export async function boot(): Promise<void> {
  let garage = loadGarage();
  applyTheme(garage);
  persistChip(garage);

  const maplibregl = (await import("maplibre-gl")).default;
  await import("maplibre-gl/dist/maplibre-gl.css");

  const mapView: MapView = await createMapView(maplibregl, garage, MIAMI);
  const { map } = mapView;

  let origin: LonLat | null = null;
  let dest: LonLat | null = null;
  let originLabel = "";
  let destLabel = "";
  let routes: SlideRoute[] = [];
  let selectedId = "";
  let selectedCoords: [number, number][] = [];
  let streak = 0;
  let tracker: TrackerHandle | null = null;
  let liveFix: Fix | null = null;
  let followCamera = true;
  let planning = false;
  let routeChips: InstanceType<typeof maplibregl.Marker>[] = [];
  let hudMode: HudMode = "plan";

  const fromInput = $("#from") as HTMLInputElement;
  const toInput = $("#to") as HTMLInputElement;
  const dashEl = $("#dash");
  const routesEl = $("#routes");
  const speedsEl = $("#speeds");
  const garageEl = $("#garage");
  const maneuverEl = $("#maneuver");
  const postedEl = $("#posted");
  const recenterEl = $("#recenter");
  const driveBarEl = $("#drive-bar");
  const reviewEl = $("#review-sheet");
  const overflowEl = $("#overflow");

  const drive = createDriveSession({
    mapView,
    maplibregl,
    garage: () => garage,
    liveFix: () => liveFix,
    followCamera: () => followCamera,
    hudMode: () => hudMode,
  });

  function persist() {
    saveGarage(garage);
    applyTheme(garage);
    persistChip(garage);
    refreshPlaceChips();
  }

  function persistChip(cfg: GarageConfig) {
    const chip = document.querySelector("#rank-chip");
    if (chip) chip.textContent = cfg.tag;
  }

  function rememberRecent(hit: { label: string; lon: number; lat: number }) {
    garage.recents = [
      asSavedPlace(hit),
      ...garage.recents.filter((r) => r.label !== hit.label),
    ].slice(0, 4);
    persist();
    renderRecents();
  }

  function renderRecents() {
    const box = $("#recents");
    const items = garage.recents;
    if (!items.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = `<div class="recents-label">Recent</div>${items.map((r) => `<button type="button" class="recent-item" data-lon="${r.lon}" data-lat="${r.lat}">${esc(r.label)}</button>`).join("")}`;
    box.querySelectorAll<HTMLButtonElement>(".recent-item").forEach((btn) => {
      btn.onclick = () => {
        dest = { lon: Number(btn.dataset.lon), lat: Number(btn.dataset.lat) };
        destLabel = btn.textContent || "";
        toInput.value = destLabel;
        ensureOrigin();
        void plan();
      };
    });
  }

  function ensureOrigin() {
    if (origin) return;
    const c = map.getCenter();
    origin = { lon: c.lng, lat: c.lat };
    originLabel = "Map center";
    fromInput.value = "Map center";
  }

  function savePlace(slot: "home" | "work") {
    if (!dest) { showError("Set a destination first, then save it as Home or Work."); return; }
    garage[slot] = asSavedPlace({ label: destLabel || toInput.value, lon: dest.lon, lat: dest.lat });
    persist();
    refreshPlaceChips();
  }

  function useOrSavePlace(slot: "home" | "work") {
    const saved = garage[slot];
    if (saved) {
      dest = { lon: saved.lon, lat: saved.lat };
      destLabel = saved.label;
      toInput.value = saved.label;
      showError("");
      ensureOrigin();
      void plan();
      return;
    }
    savePlace(slot);
  }

  function savedChipPlace() {
    const skip = new Set([garage.home?.label, garage.work?.label].filter(Boolean) as string[]);
    return garage.recents.find((r) => !skip.has(r.label)) ?? null;
  }

  function refreshPlaceChips() {
    for (const slot of ["home", "work"] as const) {
      const btn = $(`#chip-${slot}`);
      const saved = garage[slot];
      btn.classList.toggle("empty", !saved);
      btn.textContent = saved ? slot[0].toUpperCase() + slot.slice(1) : `Set ${slot}`;
    }
    const extra = $("#chip-saved");
    const saved = savedChipPlace();
    extra.toggleAttribute("hidden", !saved);
    extra.textContent = saved ? saved.label.split(",")[0] : "";
  }

  function paintSwatches(el: HTMLElement, colors: string[], current: string, onPick: (c: string) => void) {
    el.innerHTML = "";
    colors.forEach((c) => {
      const b = document.createElement("button");
      b.className = "swatch" + (c === current ? " on" : "");
      b.style.background = c;
      b.onclick = () => { onPick(c); paintSwatches(el, colors, c, onPick); };
      el.appendChild(b);
    });
  }

  function wireGarage() {
    const tag = $("#g-tag") as HTMLInputElement;
    const trail = $("#g-trail") as HTMLSelectElement;
    const cam = $("#g-cam") as HTMLSelectElement;
    const build = $("#g-build") as HTMLInputElement;
    const ghostsBox = $("#g-ghosts") as HTMLInputElement;
    const share = $("#g-share") as HTMLInputElement;
    tag.value = garage.tag; trail.value = garage.trail; cam.value = garage.camera;
    build.checked = garage.showBuildings; ghostsBox.checked = garage.showGhosts; share.checked = garage.shareGhost;
    paintSwatches($("#g-body"), ["#e8eef2", "#7cf0d8", "#b388ff", "#ff8a4c", "#8fd3ff", "#111318"], garage.carColor, (c) => {
      garage.carColor = c; persist(); drive.restylePlayer();
    });
    paintSwatches($("#g-glow"), ["#78e0c8", "#b388ff", "#ffc857", "#8fd3ff", "#d6ff3c"], garage.glow, (c) => {
      garage.glow = c; persist();
    });
    tag.addEventListener("change", () => { garage.tag = tag.value.toUpperCase() || "SLIDE-01"; persist(); });
    trail.addEventListener("change", () => { garage.trail = trail.value as GarageConfig["trail"]; persist(); paintRoutes(); });
    cam.addEventListener("change", () => { garage.camera = cam.value as GarageConfig["camera"]; persist(); mapView.applyCamera(garage.camera); });
    build.addEventListener("change", () => {
      garage.showBuildings = build.checked; persist();
      if (build.checked) mapView.ensure3DBuildings();
      mapView.toggleBuildings(build.checked);
    });
    ghostsBox.addEventListener("change", () => { garage.showGhosts = ghostsBox.checked; persist(); drive.setGhostVisibility(garage.showGhosts); });
    share.addEventListener("change", () => { garage.shareGhost = share.checked; persist(); });
  }

  function setHudMode(mode: HudMode) {
    hudMode = mode;
    document.body.dataset.mode = mode;
    const driving = mode === "drive";
    const reviewing = mode === "review";
    driveBarEl.toggleAttribute("hidden", !driving);
    reviewEl.toggleAttribute("hidden", !reviewing);
    if (driving) {
      speedsEl.setAttribute("hidden", "");
      mapView.toggleBuildings(garage.showBuildings);
      $("#search-card").classList.remove("open");
    } else {
      overflowEl.classList.remove("open", "from-plan");
      garageEl.classList.remove("open");
      maneuverEl.setAttribute("hidden", "");
      postedEl.setAttribute("hidden", "");
      $("#speedo").setAttribute("hidden", "");
      recenterEl.setAttribute("hidden", "");
      speedsEl.setAttribute("hidden", "");
    }
    paintRouteChips();
    requestAnimationFrame(() => {
      map.resize();
      if (driving || reviewing) mapView.fitToRoute(selectedCoords, hudMode);
      else mapView.applyPlanView(garage.showBuildings);
    });
  }

  function startDrive() {
    if (!routes.length) return;
    renderSpeedRail();
    const route = routes.find((r) => r.id === selectedId);
    if (!route) return;
    void drive.boot(route, () => import("./lib/ghosts"));
    setHudMode("drive");
    streak += 1;
    $("#stat-streak").textContent = String(streak);
  }

  function endDrive() {
    drive.stop();
    followCamera = true;
    if (routes.length) {
      loadSelectedRoute();
      paintRouteChips();
      renderReview();
      setHudMode("review");
    } else {
      setHudMode("plan");
    }
  }

  function backToSearch() {
    followCamera = true;
    $("#search-card").classList.add("open");
    setHudMode("plan");
  }

  function loadSelectedRoute() {
    const route = routes.find((r) => r.id === selectedId);
    selectedCoords = route ? decodePolyline6(tripShape(route.trip)) : [];
    return route;
  }

  function paintRoutes() {
    mapView.whenStyleReady(() => {
      mapView.addRouteLayers();
      const features = routePaintFeatures(routes, selectedId);
      (map.getSource("routes") as import("maplibre-gl").GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features,
      } as FeatureCollection);
      mapView.paintRouteColors(TRAILS[garage.trail].line);
    });
    paintRouteChips();
  }

  function paintRouteChips() {
    routeChips.forEach((m) => m.remove());
    routeChips = [];
    if (hudMode === "drive" || routes.length < 2) return;
    routes.forEach((r, i) => {
      const coords = decodePolyline6(tripShape(r.trip));
      if (!coords.length) return;
      const el = document.createElement("button");
      el.className = "route-chip" + (r.id === selectedId ? " on" : "");
      el.type = "button";
      el.innerHTML = `<b>${formatDuration(r.durationSec)}</b><span>${r.label}</span>`;
      el.onclick = (ev) => { ev.stopPropagation(); selectRoute(r.id); };
      const along = Math.min(0.78, 0.38 + i * 0.16);
      routeChips.push(
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(coords[Math.floor(coords.length * along)])
          .addTo(map)
      );
    });
  }

  function selectRoute(id: string) {
    selectedId = id;
    loadSelectedRoute();
    paintRoutes();
    renderDash();
    renderReview();
    if (hudMode === "drive") {
      renderSpeedRail();
      const route = routes.find((r) => r.id === selectedId);
      if (route) void drive.boot(route, () => import("./lib/ghosts"));
      mapView.fitToRoute(selectedCoords, hudMode);
    } else if (hudMode === "review") {
      mapView.fitToRoute(selectedCoords, hudMode);
    }
  }

  function renderReview() {
    const sel = routes.find((r) => r.id === selectedId);
    if (!sel) {
      reviewEl.setAttribute("hidden", "");
      return;
    }
    $("#review-eta").textContent = formatDuration(sel.durationSec);
    $("#review-dist").textContent = formatMiles(sel.distanceMi);
    $("#review-via").textContent = viaLine(sel.maneuvers);
    const shortWhy = sel.why.split(" · ")[0] || sel.label;
    $("#review-tag").textContent = sel.label === shortWhy ? sel.label : `${sel.label} · ${shortWhy}`;
  }

  function renderDash() {
    dashEl.removeAttribute("hidden");
    const sel = routes.find((r) => r.id === selectedId);
    if (sel) {
      $("#stat-score").textContent = String(sel.slideScore);
      $("#stat-eta").textContent = arrivalClock(sel.durationSec);
    }
    routesEl.innerHTML = routes.map((r) => {
      const on = r.id === selectedId ? " selected" : "";
      return `<button class="route-option${on}" data-id="${r.id}"><div class="row"><span class="tag">${r.label} · ${r.slideScore}</span><b>${formatDuration(r.durationSec)}</b></div><div class="why">${formatMiles(r.distanceMi)} · ${r.turns} turn${r.turns === 1 ? "" : "s"} · ${r.why}</div></button>`;
    }).join("");
    routesEl.querySelectorAll<HTMLButtonElement>(".route-option").forEach((btn) => {
      btn.onclick = () => selectRoute(btn.dataset.id || selectedId);
    });
  }

  function renderSpeedRail() {
    const route = routes.find((r) => r.id === selectedId);
    if (!route) { speedsEl.setAttribute("hidden", ""); return; }
    speedsEl.innerHTML = `<h2>${originLabel || "Start"} → ${destLabel || "End"} · posted ${Math.round(route.postedCoverage * 100)}%</h2><div class="bands">${route.bands.map((b) => `<div class="band"><div class="name">${esc(b.name)}</div><div class="spd">${b.postedMph ?? "—"} <small>posted</small></div><div class="sub">expect ${b.expectedMph || "—"} · ${formatMiles(b.toMi - b.fromMi)}</div></div>`).join("")}</div>`;
    if (hudMode === "plan") speedsEl.removeAttribute("hidden");
    else speedsEl.setAttribute("hidden", "");
  }

  async function plan() {
    if (planning) return;
    showError("");
    showNetBanner("");
    if (!origin) ensureOrigin();
    if (!origin) return showError("Set a start point.");
    if (!dest) return showError("Set a destination.");
    planning = true;
    const goBtn = $("#go") as HTMLButtonElement;
    goBtn.disabled = true;
    setStatus("Scoring the smoothest 3D line…");
    try {
      const result = await planRoutes(origin, dest, originLabel, destLabel);
      routes = result.routes;
      selectedId = result.selectedId;
      loadSelectedRoute();
      paintRoutes();
      renderDash();
      renderReview();
      setHudMode("review");
      setStatus("");
    } catch (err) {
      const msg = planErrorMessage(err);
      showError(msg);
      if (err instanceof NetError) showNetBanner(msg);
      setStatus("");
    } finally {
      planning = false;
      goBtn.disabled = false;
    }
  }

  function stopTracking() {
    tracker?.stop();
    tracker = null;
    liveFix = null;
    $("#locate").classList.remove("on");
    $("#locate").textContent = "Locate";
  }

  function locateMe() {
    if (tracker) { stopTracking(); setStatus(""); return; }
    setStatus("Finding you…");
    $("#locate").classList.add("on");
    $("#locate").textContent = "Tracking";
    let first = true;
    tracker = startTracking(
      (fix) => {
        liveFix = fix;
        if (!first) return;
        first = false;
        origin = fix.pos;
        originLabel = "Current location";
        fromInput.value = "Current location";
        setStatus("");
        const phonePlan = window.innerWidth < 820 && hudMode !== "drive";
        map.easeTo({
          center: [fix.pos.lon, fix.pos.lat],
          zoom: phonePlan ? 13.6 : 15.4,
          pitch: phonePlan ? 8 : 60,
          bearing: phonePlan ? 0 : map.getBearing(),
          duration: 900,
        });
      },
      (message) => { showError(message); setStatus(""); stopTracking(); }
    );
  }

  bindSearch(fromInput, $("#from-suggest"), () => origin, MIAMI, (hit: SearchHit) => {
    origin = { lon: hit.lon, lat: hit.lat };
    originLabel = hit.label;
    fromInput.value = hit.label;
  });
  bindSearch(toInput, $("#to-suggest"), () => origin, MIAMI, (hit: SearchHit) => {
    dest = { lon: hit.lon, lat: hit.lat };
    destLabel = hit.label;
    toInput.value = hit.label;
    rememberRecent(hit);
    ensureOrigin();
    void plan();
  });

  $("#locate").addEventListener("click", locateMe);
  $("#locate-fab").addEventListener("click", locateMe);
  $("#menu-fab").addEventListener("click", () => {
    overflowEl.classList.toggle("open");
    overflowEl.classList.toggle("from-plan", overflowEl.classList.contains("open"));
  });
  $("#compass-fab").addEventListener("click", () => {
    followCamera = true;
    map.easeTo({ bearing: 0, pitch: window.innerWidth < 820 && hudMode === "plan" ? 8 : map.getPitch(), duration: 500 });
  });
  toInput.addEventListener("focus", () => $("#search-card").classList.add("open"));
  $("#go").addEventListener("click", () => void plan());
  $("#tune").addEventListener("click", () => garageEl.classList.toggle("open"));
  $("#g-close").addEventListener("click", () => garageEl.classList.remove("open"));
  recenterEl.addEventListener("click", () => {
    followCamera = true;
    recenterEl.setAttribute("hidden", "");
    mapView.fitToRoute(selectedCoords, hudMode);
  });
  $("#review-go").addEventListener("click", startDrive);
  $("#review-back").addEventListener("click", backToSearch);
  $("#end-drive").addEventListener("click", endDrive);
  $("#help").addEventListener("click", () => showCoach(true));
  $("#coach-ok").addEventListener("click", () => {
    garage.coachDismissed = true;
    persist();
    showCoach(false);
  });
  $("#more").addEventListener("click", () => overflowEl.classList.toggle("open"));
  $("#ov-tune").addEventListener("click", () => { overflowEl.classList.remove("open"); garageEl.classList.add("open"); });
  $("#ov-help").addEventListener("click", () => { overflowEl.classList.remove("open"); showCoach(true); });
  $("#ov-rail").addEventListener("click", () => {
    overflowEl.classList.remove("open");
    speedsEl.toggleAttribute("hidden", !speedsEl.hasAttribute("hidden"));
  });
  $("#ov-home").addEventListener("click", () => { overflowEl.classList.remove("open"); savePlace("home"); });
  $("#ov-work").addEventListener("click", () => { overflowEl.classList.remove("open"); savePlace("work"); });
  $("#chip-home").addEventListener("click", () => useOrSavePlace("home"));
  $("#chip-work").addEventListener("click", () => useOrSavePlace("work"));
  $("#chip-saved").addEventListener("click", () => {
    const saved = savedChipPlace();
    if (!saved) return;
    dest = { lon: saved.lon, lat: saved.lat };
    destLabel = saved.label;
    toInput.value = saved.label;
    showError("");
    ensureOrigin();
    void plan();
  });
  $("#search-card").addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("button") || t.closest("input") || t.closest(".suggest")) return;
    toInput.focus();
  });
  window.addEventListener("resize", () => {
    map.resize();
    if (hudMode === "drive") mapView.fitToRoute(selectedCoords, hudMode);
  });
  map.on("dragstart", () => {
    if (garage.camera === "chase") { followCamera = false; recenterEl.removeAttribute("hidden"); }
  });
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest(".field") && !t.closest(".where-row")) {
      document.querySelectorAll<HTMLElement>(".suggest").forEach((b) => { b.hidden = true; });
    }
    if (!t.closest("#search-card") && !t.closest("#menu-fab") && !t.closest(".overflow")) {
      $("#search-card").classList.remove("open");
      if (!t.closest("#more")) overflowEl.classList.remove("open", "from-plan");
    }
  });
  toInput.addEventListener("keydown", (e) => { if (e.key === "Enter") void plan(); });
  window.addEventListener("offline", () => showNetBanner("You're offline. Check the connection and try again."));
  window.addEventListener("online", () => showNetBanner(""));

  wireGarage();
  refreshPlaceChips();
  renderRecents();
  setHudMode("plan");
  if (!garage.coachDismissed) showCoach(true);
}
