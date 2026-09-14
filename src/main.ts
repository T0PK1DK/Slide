import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { decodePolyline6 } from "./lib/polyline";
import {
  collectTrips,
  requestRoutes,
  requestTraceAttributes,
  sameTrip,
  searchPlaces,
  tripShape,
  type LonLat,
  type SearchHit,
} from "./lib/valhalla";
import {
  arrivalClock,
  formatDuration,
  formatMiles,
  rankRoutes,
  scoreTrip,
  type SlideRoute,
} from "./lib/smooth";
import { loadGarage, saveGarage, TRAILS, type GarageConfig } from "./lib/garage";
import { chasePoint, seedGhosts, stepGhost, type GhostCar } from "./lib/ghosts";
import {
  buildSteps,
  formatShortDistance,
  maneuverArrow,
  nextMove,
  postedOutlook,
  type Step,
} from "./lib/guidance";
import {
  BUILDING_PAINT,
  hudFitPadding,
  liftNightBasemap,
  LINE_LAYOUT,
  routeLayerPaints,
} from "./lib/maplook";
import { cumulativeMiles, snapToRoute, startTracking, type Fix, type TrackerHandle } from "./lib/tracking";

const MIAMI: LonLat = { lon: -80.1918, lat: 25.7617 };
const STYLE = "https://tiles.openfreemap.org/styles/dark";

let garage = loadGarage();
applyTheme(garage);

const app = document.querySelector("#app")!;
app.innerHTML = `
  <div id="map"></div>
  <div class="vignette"></div>
  <div class="hud">
    <div class="panel search-card plan-only" id="search-card">
      <div class="brand"><h1>Slide</h1><span class="chip" id="rank-chip">GARAGE</span><button class="icon" id="help" type="button" aria-label="How to Slide">?</button></div>
      <div class="fields">
        <div class="field"><label>From</label><input id="from" placeholder="Current location or address" autocomplete="off" /><div class="suggest" id="from-suggest" hidden></div></div>
        <div class="field"><label>To</label><input id="to" placeholder="Where to?" autocomplete="off" /><div class="suggest" id="to-suggest" hidden></div></div>
      </div>
      <div class="place-chips" id="place-chips">
        <button type="button" class="place-chip" id="chip-home">Home</button>
        <button type="button" class="place-chip" id="chip-work">Work</button>
      </div>
      <div class="actions">
        <button class="primary" id="go">Drop the line</button>
        <button class="ghost" id="locate">Locate</button>
        <button class="icon" id="tune">Tune</button>
      </div>
      <div class="error" id="error" hidden></div>
    </div>
    <button class="map-fab plan-only" id="locate-fab" type="button" aria-label="Locate">⌖</button>
    <div class="panel status-pill" id="status">Locking a 3D line…</div>
    <div class="panel maneuver drive-only" id="maneuver" hidden>
      <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path id="man-arrow" d="" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="man-text"><b id="man-dist">—</b><span id="man-instr">—</span></div>
      <div class="man-bar"><i id="man-fill"></i></div>
    </div>
    <div class="panel posted-chip drive-only" id="posted" hidden></div>
    <div class="panel dash plan-only" id="dash" hidden>
      <div class="stat-row">
        <div class="stat"><span>Slide</span><b id="stat-score">—</b></div>
        <div class="stat"><span>Arrive</span><b id="stat-eta">—</b></div>
        <div class="stat"><span>Ghosts</span><b id="stat-ghosts">0</b></div>
        <div class="stat"><span>Streak</span><b id="stat-streak">0</b></div>
      </div>
      <div id="routes"></div>
    </div>
    <div class="speedo drive-only" id="speedo" hidden>
      <div class="cluster">
        <div class="limit" id="limit" hidden><span>Limit</span><b id="limit-n">—</b></div>
        <div class="live"><div class="n" id="speed-n">0</div><div class="u" id="speed-src">Est</div></div>
      </div>
      <div class="ghost-delta" id="ghost-delta">GHOST ±0.0s</div>
    </div>
    <button class="panel recenter drive-only" id="recenter" hidden>Recenter</button>
    <div class="panel speed-rail" id="speeds" hidden></div>
    <div class="panel drive-bar drive-only" id="drive-bar" hidden>
      <div class="meta"><b id="drive-eta">—</b><span id="drive-remain">—</span></div>
      <button class="icon" id="more" type="button" aria-label="More">⋯</button>
      <button class="end" id="end-drive" type="button">End</button>
    </div>
    <div class="panel overflow" id="overflow">
      <button type="button" id="ov-tune">Tune garage</button>
      <button type="button" id="ov-help">How to Slide</button>
      <button type="button" id="ov-rail">Speed rail</button>
      <button type="button" id="ov-home">Save To as Home</button>
      <button type="button" id="ov-work">Save To as Work</button>
    </div>
    <div class="coach" id="coach" hidden>
      <div class="panel coach-card">
        <h2>How to Slide</h2>
        <ol>
          <li>Set <b>From</b> and <b>Where to?</b><span>Search, Locate, or a Home / Work chip.</span></li>
          <li>Tap <b>Drop the line</b><span>Slide picks the smoothest road, not the fastest.</span></li>
          <li>Follow the banner<span>Posted limit is the sign. Never a target to beat.</span></li>
        </ol>
        <button class="primary" id="coach-ok" type="button">Got it</button>
      </div>
    </div>
    <div class="panel garage" id="garage">
      <div class="garage-head"><h3>Garage</h3><button class="close" id="g-close" aria-label="Close garage">×</button></div>
      <label>Tag</label><input id="g-tag" type="text" maxlength="12" />
      <label>Body</label><div class="swatches" id="g-body"></div>
      <label>Glow</label><div class="swatches" id="g-glow"></div>
      <label>Trail</label><select id="g-trail"><option value="plasma">Plasma</option><option value="ember">Ember</option><option value="ice">Ice</option><option value="volt">Volt</option></select>
      <label>Camera</label><select id="g-cam"><option value="cinematic">Cinematic 3D</option><option value="chase">Chase</option><option value="top">Top-down</option></select>
      <div class="toggle"><span>3D buildings</span><input id="g-build" type="checkbox" /></div>
      <div class="toggle"><span>Show ghosts</span><input id="g-ghosts" type="checkbox" /></div>
      <div class="toggle"><span>Share my ghost</span><input id="g-share" type="checkbox" /></div>
    </div>
  </div>
`;

const map = new maplibregl.Map({
  container: "map",
  style: STYLE,
  center: [MIAMI.lon, MIAMI.lat],
  zoom: 14.2,
  pitch: 58,
  bearing: -18,
  attributionControl: false,
  maxPitch: 75,
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

let origin: LonLat | null = null;
let dest: LonLat | null = null;
let originLabel = "";
let destLabel = "";
let routes: SlideRoute[] = [];
let selectedId = "";
let selectedCoords: [number, number][] = [];
let ghosts: GhostCar[] = [];
let ghostMarkers: maplibregl.Marker[] = [];
let playerMarker: maplibregl.Marker | null = null;
let chaseT = 0;
let raf = 0;
let lastTs = 0;
let streak = 0;
let styleReady = false;
const styleQueue: Array<() => void> = [];
let steps: Step[] = [];
let cumulative: number[] = [];
let progressMi = 0;
let tracker: TrackerHandle | null = null;
let liveFix: Fix | null = null;
let followCamera = true;
let planning = false;
let routeChips: maplibregl.Marker[] = [];

const fromInput = $("#from") as HTMLInputElement;
const toInput = $("#to") as HTMLInputElement;
const errorEl = $("#error");
const statusEl = $("#status");
const dashEl = $("#dash");
const routesEl = $("#routes");
const speedsEl = $("#speeds");
const garageEl = $("#garage");
const maneuverEl = $("#maneuver");
const postedEl = $("#posted");
const recenterEl = $("#recenter");
const driveBarEl = $("#drive-bar");
const coachEl = $("#coach");
const overflowEl = $("#overflow");
const moreBtn = $("#more");
let hudMode: "plan" | "drive" = "plan";

map.on("load", () => {
  styleReady = true;
  liftNightBasemap(map);
  ensure3DBuildings();
  addRouteLayers();
  applyCamera(garage.camera);
  styleQueue.splice(0).forEach((fn) => fn());
});
map.on("error", () => {
  // Tiles / style can 429. Keep the HUD usable; route paint still applies on a lifted land color.
});

bindSearch(fromInput, $("#from-suggest"), (hit) => {
  origin = { lon: hit.lon, lat: hit.lat };
  originLabel = hit.label;
  fromInput.value = hit.label;
});
bindSearch(toInput, $("#to-suggest"), (hit) => {
  dest = { lon: hit.lon, lat: hit.lat };
  destLabel = hit.label;
  toInput.value = hit.label;
});
$("#locate").addEventListener("click", locateMe);
$("#locate-fab").addEventListener("click", locateMe);
$("#go").addEventListener("click", plan);
$("#tune").addEventListener("click", () => garageEl.classList.toggle("open"));
$("#g-close").addEventListener("click", () => garageEl.classList.remove("open"));
recenterEl.addEventListener("click", () => { followCamera = true; recenterEl.setAttribute("hidden", ""); fitToRoute(); });
$("#end-drive").addEventListener("click", endDrive);
$("#help").addEventListener("click", () => showCoach(true));
$("#coach-ok").addEventListener("click", () => {
  garage.coachDismissed = true;
  persist();
  showCoach(false);
});
moreBtn.addEventListener("click", () => overflowEl.classList.toggle("open"));
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
window.addEventListener("resize", () => {
  map.resize();
  if (hudMode === "drive") fitToRoute();
});
map.on("dragstart", () => { if (garage.camera === "chase") { followCamera = false; recenterEl.removeAttribute("hidden"); } });
document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (!t.closest(".field")) document.querySelectorAll<HTMLElement>(".suggest").forEach((b) => { b.hidden = true; });
});
toInput.addEventListener("keydown", (e) => { if (e.key === "Enter") plan(); });
wireGarage();
refreshPlaceChips();
setHudMode("plan");
if (!garage.coachDismissed) showCoach(true);

function showCoach(on: boolean) {
  coachEl.toggleAttribute("hidden", !on);
}

function $(sel: string): HTMLElement { return document.querySelector(sel)!; }
/** Run map work that touches sources/layers, deferring until the style has loaded. */
function whenStyleReady(fn: () => void) {
  if (styleReady) fn();
  else styleQueue.push(fn);
}
function applyTheme(cfg: GarageConfig) {
  document.documentElement.style.setProperty("--glow", cfg.glow);
  document.documentElement.style.setProperty("--mint", TRAILS[cfg.trail].line);
}
function persist() {
  saveGarage(garage);
  applyTheme(garage);
  $("#rank-chip").textContent = garage.tag;
  refreshPlaceChips();
}
function savePlace(slot: "home" | "work") {
  if (!dest) { showError("Set a destination first, then save it as Home or Work."); return; }
  garage[slot] = { label: destLabel || toInput.value, lon: dest.lon, lat: dest.lat };
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
    return;
  }
  savePlace(slot);
}
function refreshPlaceChips() {
  for (const slot of ["home", "work"] as const) {
    const btn = $(`#chip-${slot}`);
    const saved = garage[slot];
    btn.classList.toggle("empty", !saved);
    btn.textContent = saved ? slot[0].toUpperCase() + slot.slice(1) : `Set ${slot}`;
  }
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
  paintSwatches($("#g-body"), ["#e8eef2","#7cf0d8","#b388ff","#ff8a4c","#8fd3ff","#111318"], garage.carColor, (c) => { garage.carColor = c; persist(); restylePlayer(); });
  paintSwatches($("#g-glow"), ["#78e0c8","#b388ff","#ffc857","#8fd3ff","#d6ff3c"], garage.glow, (c) => { garage.glow = c; persist(); });
  tag.addEventListener("change", () => { garage.tag = tag.value.toUpperCase() || "SLIDE-01"; persist(); });
  trail.addEventListener("change", () => { garage.trail = trail.value as GarageConfig["trail"]; persist(); paintRoutes(); });
  cam.addEventListener("change", () => { garage.camera = cam.value as GarageConfig["camera"]; persist(); applyCamera(garage.camera); });
  build.addEventListener("change", () => { garage.showBuildings = build.checked; persist(); toggleBuildings(build.checked); });
  ghostsBox.addEventListener("change", () => { garage.showGhosts = ghostsBox.checked; persist(); setGhostVisibility(garage.showGhosts); });
  share.addEventListener("change", () => { garage.shareGhost = share.checked; persist(); });
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
function setHudMode(mode: "plan" | "drive") {
  hudMode = mode;
  document.body.dataset.mode = mode;
  const driving = mode === "drive";
  driveBarEl.toggleAttribute("hidden", !driving);
  if (!driving) {
    overflowEl.classList.remove("open");
    garageEl.classList.remove("open");
    maneuverEl.setAttribute("hidden", "");
    postedEl.setAttribute("hidden", "");
    $("#speedo").setAttribute("hidden", "");
    recenterEl.setAttribute("hidden", "");
    speedsEl.setAttribute("hidden", "");
  }
  requestAnimationFrame(() => {
    map.resize();
    if (driving) fitToRoute();
  });
}
function endDrive() {
  setHudMode("plan");
  followCamera = true;
}
function applyCamera(mode: GarageConfig["camera"]) {
  if (mode === "top") map.easeTo({ pitch: 0, zoom: Math.max(map.getZoom(), 13), duration: 700 });
  else if (mode === "chase") map.easeTo({ pitch: 62, zoom: 16.2, duration: 700 });
  else map.easeTo({ pitch: 56, zoom: 14.6, duration: 700 });
}
function ensure3DBuildings() {
  if (map.getLayer("slide-buildings")) return;
  const sourceId = map.getSource("openmaptiles") ? "openmaptiles" : Object.keys(map.getStyle().sources || {})[0];
  if (!sourceId) return;
  try {
    map.addLayer({
      id: "slide-buildings",
      source: sourceId,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 13,
        paint: BUILDING_PAINT as never,
    });
  } catch {}
  toggleBuildings(garage.showBuildings);
}
function toggleBuildings(on: boolean) {
  if (map.getLayer("slide-buildings")) map.setLayoutProperty("slide-buildings", "visibility", on ? "visible" : "none");
}
function emptyFc(): FeatureCollection { return { type: "FeatureCollection", features: [] }; }
function addRouteLayers() {
  if (map.getSource("routes")) return;
  map.addSource("routes", { type: "geojson", data: emptyFc() });
  map.addSource("ghost-trails", { type: "geojson", data: emptyFc() });
  const paint = routeLayerPaints(TRAILS[garage.trail].line);
  map.addLayer({ id: "route-glow", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.glow as never });
  map.addLayer({ id: "route-case", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.case as never });
  map.addLayer({ id: "route-line", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.line as never });
  map.addLayer({ id: "route-core", type: "line", source: "routes", layout: LINE_LAYOUT, paint: paint.core as never });
  map.addLayer({ id: "ghost-trails", type: "line", source: "ghost-trails", paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.55, "line-dasharray": [1, 1.2] } });
}
function bindSearch(input: HTMLInputElement, box: HTMLElement, onPick: (hit: SearchHit) => void) {
  let timer = 0; let items: SearchHit[] = []; let active = -1;
  const close = () => { box.hidden = true; active = -1; };
  const draw = () => renderSuggest(box, items, active, (hit) => { onPick(hit); close(); });

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        items = await searchPlaces(input.value, origin ?? MIAMI);
        active = -1;
        draw();
        box.hidden = items.length === 0;
      } catch { close(); }
    }, 200);
  });

  input.addEventListener("keydown", (e) => {
    if (box.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = e.key === "ArrowDown"
        ? Math.min(active + 1, items.length - 1)
        : Math.max(active - 1, 0);
      draw();
    } else if (e.key === "Enter" && active >= 0) {
      // Beat the To-field Enter handler, which would otherwise plan a route
      // using the previous pin while the driver is still choosing one.
      e.preventDefault();
      e.stopImmediatePropagation();
      onPick(items[active]);
      close();
    } else if (e.key === "Escape") {
      close();
    }
  });
}
function renderSuggest(box: HTMLElement, items: SearchHit[], active: number, onPick: (hit: SearchHit) => void) {
  box.innerHTML = "";
  items.forEach((hit, i) => {
    const btn = document.createElement("button");
    btn.textContent = hit.label;
    btn.type = "button";
    if (i === active) { btn.classList.add("active"); btn.scrollIntoView({ block: "nearest" }); }
    btn.onclick = () => { onPick(hit); box.hidden = true; };
    box.appendChild(btn);
  });
}
function stopTracking() {
  tracker?.stop();
  tracker = null;
  liveFix = null;
  $("#locate").classList.remove("on");
  $("#locate").textContent = "Locate";
}
/** Toggles a live GPS watch — the speedo reads real mph while this is on. */
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
      map.easeTo({ center: [fix.pos.lon, fix.pos.lat], zoom: 15.4, pitch: 60, duration: 900 });
    },
    (message) => { showError(message); setStatus(""); stopTracking(); }
  );
}
async function plan() {
  if (planning) return;
  showError("");
  if (!origin) return showError("Set a start point.");
  if (!dest) return showError("Set a destination.");
  planning = true;
  const goBtn = $("#go") as HTMLButtonElement;
  goBtn.disabled = true;
  setStatus("Scoring the smoothest 3D line…");
  try {
    const raw = await requestRoutes(origin, dest);
    let trips = collectTrips(raw);
    if (!trips.length) throw new Error("No routes returned.");
    if (trips.length < 2) {
      // `alternatives: true` frequently answers with a single trip, which
      // leaves "smoothest" with nothing to be smoother than. Ask again with
      // the costing pushed the other way and keep it if it is a real detour.
      try {
        const fast = collectTrips(await requestRoutes(origin, dest, "miles", "fast"));
        trips = trips.concat(fast.filter((t) => !trips.some((seen) => sameTrip(seen, t))).slice(0, 1));
      } catch {
        // One good line still answers the question.
      }
    }
    const scored = [];
    for (const trip of trips) {
      const attrs = await requestTraceAttributes(tripShape(trip));
      scored.push(scoreTrip(trip, attrs.edges ?? [], "miles"));
    }
    routes = rankRoutes(scored);
    selectedId = routes[0]?.id ?? "";
    paintRoutes(); renderDash(); renderSpeedRail(); bootDrive(); setHudMode("drive"); fitToRoute();
    setStatus(""); streak += 1; $("#stat-streak").textContent = String(streak);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Routing failed.";
    showError(/failed|network|fetch|load/i.test(msg) ? "Can't reach routing right now. Check your connection and try again." : msg);
    setStatus("");
  } finally {
    planning = false;
    goBtn.disabled = false;
  }
}
function fitToRoute() {
  if (!selectedCoords.length) return;
  whenStyleReady(() => {
    const bounds = new maplibregl.LngLatBounds(selectedCoords[0], selectedCoords[0]);
    for (const c of selectedCoords) bounds.extend(c);
    followCamera = true;
    map.fitBounds(bounds, {
      padding: hudFitPadding(),
      pitch: window.innerWidth < 820 ? 48 : 52,
      bearing: -18,
      maxZoom: window.innerWidth < 820 ? 15.2 : 15.4,
      duration: 1100,
    });
  });
}
function selectRoute(id: string) {
  selectedId = id;
  paintRoutes(); renderDash(); renderSpeedRail(); bootDrive();
  if (hudMode === "drive") fitToRoute();
}
function paintRoutes() {
  whenStyleReady(() => {
    addRouteLayers();
    const features = routes.map((r) => ({
      type: "Feature" as const,
      properties: { id: r.id, selected: r.id === selectedId },
      geometry: { type: "LineString" as const, coordinates: decodePolyline6(r.trip.legs.map((l) => l.shape).join("")) },
    }));
    (map.getSource("routes") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features });
    if (map.getLayer("route-glow")) map.setPaintProperty("route-glow", "line-color", TRAILS[garage.trail].line);
    const next = routeLayerPaints(TRAILS[garage.trail].line);
    if (map.getLayer("route-line")) map.setPaintProperty("route-line", "line-color", next.line["line-color"] as never);
    if (map.getLayer("route-core")) map.setPaintProperty("route-core", "line-color", next.core["line-color"] as never);
  });
  paintRouteChips();
}
/** Tappable time chips sitting on each line, the way every map app labels alternatives. */
function paintRouteChips() {
  routeChips.forEach((m) => m.remove());
  routeChips = [];
  if (routes.length < 2) return;
  for (const r of routes) {
    const coords = decodePolyline6(tripShape(r.trip));
    if (!coords.length) continue;
    const el = document.createElement("button");
    el.className = "route-chip" + (r.id === selectedId ? " on" : "");
    el.innerHTML = `<b>${formatDuration(r.durationSec)}</b><span>${r.label}</span>`;
    el.onclick = (ev) => { ev.stopPropagation(); selectRoute(r.id); };
    routeChips.push(
      new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(coords[Math.floor(coords.length * 0.55)])
        .addTo(map)
    );
  }
}
function renderDash() {
  dashEl.removeAttribute("hidden");
  const sel = routes.find((r) => r.id === selectedId);
  if (sel) { $("#stat-score").textContent = String(sel.slideScore); $("#stat-eta").textContent = arrivalClock(sel.durationSec); }
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
  speedsEl.removeAttribute("hidden");
  speedsEl.innerHTML = `<h2>${originLabel || "Start"} → ${destLabel || "End"} · posted ${Math.round(route.postedCoverage * 100)}%</h2><div class="bands">${route.bands.map((b) => `<div class="band"><div class="name">${esc(b.name)}</div><div class="spd">${b.postedMph ?? "—"} <small>posted</small></div><div class="sub">expect ${b.expectedMph || "—"} · ${formatMiles(b.toMi - b.fromMi)}</div></div>`).join("")}</div>`;
}
function bootDrive() {
  const route = routes.find((r) => r.id === selectedId);
  if (!route) return;
  selectedCoords = decodePolyline6(tripShape(route.trip));
  if (!selectedCoords.length) return;
  cumulative = cumulativeMiles(selectedCoords);
  steps = buildSteps(route.maneuvers);
  progressMi = 0;
  chaseT = 0; spawnPlayer(); spawnGhosts();
  $("#speedo").removeAttribute("hidden");
  if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(tick); }
}
function carSvg(color: string, glow: string, ghost = false): string {
  const opacity = ghost ? 0.6 : 1;
  const id = `cg${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 44 72" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glow}" stop-opacity=".95"/><stop offset="1" stop-color="${color}" stop-opacity="${opacity}"/></linearGradient></defs><ellipse cx="22" cy="66" rx="12" ry="4.5" fill="${glow}" opacity=".4"/><path d="M13 58 L22 8 L31 58 Z" fill="url(#${id})" stroke="${glow}" stroke-width="1.8"/><path d="M17 32 L22 16 L27 32 Z" fill="#0b1218" opacity=".4"/><circle cx="16" cy="14" r="2.2" fill="#fff6c8"/><circle cx="28" cy="14" r="2.2" fill="#fff6c8"/></svg>`;
}
function spawnPlayer() {
  playerMarker?.remove();
  const el = document.createElement("div");
  el.className = "car-marker";
  el.innerHTML = carSvg(garage.carColor, garage.glow);
  playerMarker = new maplibregl.Marker({ element: el, anchor: "center", pitchAlignment: "map", rotationAlignment: "map" }).setLngLat(selectedCoords[0]).addTo(map);
}
function restylePlayer() {
  if (!playerMarker) return;
  playerMarker.getElement().innerHTML = carSvg(garage.carColor, garage.glow);
}
function spawnGhosts() {
  ghostMarkers.forEach((m) => m.remove()); ghostMarkers = [];
  ghosts = garage.showGhosts ? seedGhosts(selectedCoords, garage.tag) : [];
  if (!garage.shareGhost) ghosts = ghosts.filter((g) => g.tag !== garage.tag.slice(0, 8));
  $("#stat-ghosts").textContent = String(ghosts.length);
  const trails: Feature[] = [];
  for (const g of ghosts) {
    const el = document.createElement("div");
    el.className = "ghost-marker"; el.style.color = g.color;
    el.innerHTML = `<div class="ghost-label">${g.tag}</div>${carSvg(g.color, g.color, true)}`;
    ghostMarkers.push(new maplibregl.Marker({ element: el, anchor: "center", pitchAlignment: "map", rotationAlignment: "map" }).setLngLat([g.samples[0].lon, g.samples[0].lat]).addTo(map));
    trails.push({ type: "Feature", properties: { color: g.color }, geometry: { type: "LineString", coordinates: g.samples.map((s) => [s.lon, s.lat]) } });
  }
  whenStyleReady(() => {
    addRouteLayers();
    (map.getSource("ghost-trails") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: garage.showGhosts ? trails : [] });
  });
}
function setGhostVisibility(show: boolean) {
  ghostMarkers.forEach((m) => { m.getElement().style.display = show ? "block" : "none"; });
}
function tick(ts: number) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts;
  if (!selectedCoords.length) { raf = requestAnimationFrame(tick); return; }

  const route = routes.find((r) => r.id === selectedId);
  const totalMi = cumulative[cumulative.length - 1] || route?.distanceMi || 0;
  let you: { pos: LonLat; bearing: number };
  let mph: number;
  const live = Boolean(liveFix);

  if (liveFix) {
    // Real position wins: snap the fix to the planned line so the marker tracks
    // the road rather than drifting into the buildings beside it.
    const snap = snapToRoute(selectedCoords, cumulative, liveFix.pos);
    if (snap) {
      progressMi = snap.alongMi;
      you = { pos: snap.snapped, bearing: liveFix.headingDeg ?? snap.bearing };
      setOffRoute(snap.offRouteM > 60);
    } else {
      you = { pos: liveFix.pos, bearing: liveFix.headingDeg ?? 0 };
    }
    mph = Math.round(liveFix.speedMph);
  } else {
    chaseT = (chaseT + dt * 0.015) % 1;
    you = chasePoint(selectedCoords, chaseT);
    progressMi = chaseT * totalMi;
    mph = route ? Math.round(route.distanceMi / Math.max(route.durationSec / 3600, 0.01)) : 0;
  }

  playerMarker?.setLngLat([you.pos.lon, you.pos.lat]);
  playerMarker?.setRotation(you.bearing);
  $("#speed-n").textContent = String(mph);
  $("#speed-src").textContent = live ? "MPH" : "Est";
  if (garage.camera === "chase" && followCamera) {
    map.jumpTo({ center: [you.pos.lon, you.pos.lat], bearing: you.bearing, pitch: 64, zoom: 16.4 });
  }

  renderGuidance(progressMi, mph);
  updateDriveMeta(route, progressMi);

  ghosts.forEach((g, i) => { const s = stepGhost(g, dt); ghostMarkers[i]?.setLngLat([s.lon, s.lat]); ghostMarkers[i]?.setRotation(s.bearing); });
  if (ghosts.length) {
    // Both clocks wrap at the end of the lap, so take the shortest signed gap
    // instead of letting the delta jump by a whole trip duration.
    const selfT = totalMi > 0 ? Math.min(1, progressMi / totalMi) : chaseT;
    const wrapped = ((ghosts[0].t - selfT + 0.5) % 1 + 1) % 1 - 0.5;
    const lead = (wrapped * (route?.durationSec ?? 0)).toFixed(1);
    $("#ghost-delta").textContent = `GHOST ${Number(lead) >= 0 ? "+" : ""}${lead}s`;
  } else {
    $("#ghost-delta").textContent = "NO GHOSTS";
  }
  raf = requestAnimationFrame(tick);
}
function updateDriveMeta(route: SlideRoute | undefined, mi: number) {
  if (hudMode !== "drive" || !route) return;
  const remainMi = Math.max(0, route.distanceMi - mi);
  const remainSec = route.durationSec * (remainMi / Math.max(route.distanceMi, 0.01));
  $("#drive-eta").textContent = formatDuration(remainSec);
  $("#drive-remain").textContent = `${formatMiles(remainMi)} · ${arrivalClock(remainSec)}`;
}
function setOffRoute(off: boolean) {
  maneuverEl.classList.toggle("off-route", off);
}
/** Next maneuver + what the signs are about to do. Posted is the sign, never a target. */
function renderGuidance(mi: number, mph: number) {
  const route = routes.find((r) => r.id === selectedId);
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
    // Flag the driver only against the sign, never nudge them toward it.
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
}
function setStatus(text: string) { statusEl.textContent = text; statusEl.classList.toggle("show", Boolean(text)); }
function showError(text: string) { errorEl.textContent = text; errorEl.toggleAttribute("hidden", !text); }
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ESCAPES[c]); }
persist();
