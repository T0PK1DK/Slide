import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { decodePolyline6 } from "./lib/polyline";
import {
  collectTrips,
  requestRoutes,
  requestTraceAttributes,
  searchPlaces,
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

const MIAMI: LonLat = { lon: -80.1918, lat: 25.7617 };
const STYLE = "https://tiles.openfreemap.org/styles/dark";

let garage = loadGarage();
applyTheme(garage);

const app = document.querySelector("#app")!;
app.innerHTML = `
  <div id="map"></div>
  <div class="vignette"></div>
  <div class="hud">
    <div class="panel search-card">
      <div class="brand"><h1>Slide</h1><span class="chip" id="rank-chip">GARAGE</span></div>
      <div class="fields">
        <div class="field"><label>From</label><input id="from" placeholder="Current location or address" autocomplete="off" /><div class="suggest" id="from-suggest" hidden></div></div>
        <div class="field"><label>To</label><input id="to" placeholder="Where are you going?" autocomplete="off" /><div class="suggest" id="to-suggest" hidden></div></div>
      </div>
      <div class="actions">
        <button class="primary" id="go">Drop the line</button>
        <button class="ghost" id="locate">Locate</button>
        <button class="icon" id="tune">Tune</button>
      </div>
      <div class="error" id="error" hidden></div>
    </div>
    <div class="panel status-pill" id="status">Locking a 3D line…</div>
    <div class="panel dash" id="dash" hidden>
      <div class="stat-row">
        <div class="stat"><span>Slide</span><b id="stat-score">—</b></div>
        <div class="stat"><span>Arrive</span><b id="stat-eta">—</b></div>
        <div class="stat"><span>Ghosts</span><b id="stat-ghosts">0</b></div>
        <div class="stat"><span>Streak</span><b id="stat-streak">0</b></div>
      </div>
      <div id="routes"></div>
    </div>
    <div class="speedo" id="speedo" hidden><div class="n" id="speed-n">00</div><div class="u">MPH</div><div class="ghost-delta" id="ghost-delta">GHOST ±0.0s</div></div>
    <div class="panel speed-rail" id="speeds" hidden></div>
    <div class="panel garage" id="garage">
      <h3>Garage</h3>
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

const fromInput = $("#from") as HTMLInputElement;
const toInput = $("#to") as HTMLInputElement;
const errorEl = $("#error");
const statusEl = $("#status");
const dashEl = $("#dash");
const routesEl = $("#routes");
const speedsEl = $("#speeds");
const garageEl = $("#garage");

map.on("load", () => {
  ensure3DBuildings();
  addRouteLayers();
  applyCamera(garage.camera);
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
$("#go").addEventListener("click", plan);
$("#tune").addEventListener("click", () => garageEl.classList.toggle("open"));
toInput.addEventListener("keydown", (e) => { if (e.key === "Enter") plan(); });
wireGarage();

function $(sel: string): HTMLElement { return document.querySelector(sel)!; }
function applyTheme(cfg: GarageConfig) {
  document.documentElement.style.setProperty("--glow", cfg.glow);
  document.documentElement.style.setProperty("--mint", TRAILS[cfg.trail].line);
}
function persist() {
  saveGarage(garage);
  applyTheme(garage);
  $("#rank-chip").textContent = garage.tag;
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
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], ["get", "height"], 12], 0, "#141c28", 40, "#1b2736", 120, "#243246"],
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 14],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        "fill-extrusion-opacity": 0.72,
      },
    });
  } catch {}
  toggleBuildings(garage.showBuildings);
}
function toggleBuildings(on: boolean) {
  if (map.getLayer("slide-buildings")) map.setLayoutProperty("slide-buildings", "visibility", on ? "visible" : "none");
}
function emptyFc(): GeoJSON.FeatureCollection { return { type: "FeatureCollection", features: [] }; }
function addRouteLayers() {
  if (map.getSource("routes")) return;
  map.addSource("routes", { type: "geojson", data: emptyFc() });
  map.addSource("ghost-trails", { type: "geojson", data: emptyFc() });
  map.addLayer({ id: "route-glow", type: "line", source: "routes", paint: { "line-color": TRAILS[garage.trail].line, "line-width": 14, "line-opacity": 0.18, "line-blur": 8 } });
  map.addLayer({ id: "route-case", type: "line", source: "routes", paint: { "line-color": "#061016", "line-width": 8, "line-opacity": 0.85 } });
  map.addLayer({ id: "route-line", type: "line", source: "routes", paint: { "line-color": ["case", ["==", ["get", "selected"], true], TRAILS[garage.trail].line, "#4c5d68"], "line-width": ["case", ["==", ["get", "selected"], true], 4.5, 2.5], "line-opacity": ["case", ["==", ["get", "selected"], true], 0.98, 0.35] } });
  map.addLayer({ id: "ghost-trails", type: "line", source: "ghost-trails", paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.35, "line-dasharray": [1, 1.4] } });
}
function bindSearch(input: HTMLInputElement, box: HTMLElement, onPick: (hit: SearchHit) => void) {
  let timer = 0; let items: SearchHit[] = []; let active = -1;
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try { items = await searchPlaces(input.value, origin ?? MIAMI); renderSuggest(box, items, active, onPick); box.hidden = items.length === 0; } catch { box.hidden = true; }
    }, 200);
  });
}
function renderSuggest(box: HTMLElement, items: SearchHit[], active: number, onPick: (hit: SearchHit) => void) {
  box.innerHTML = "";
  items.forEach((hit, i) => {
    const btn = document.createElement("button");
    btn.textContent = hit.label;
    if (i === active) btn.classList.add("active");
    btn.onclick = () => { onPick(hit); box.hidden = true; };
    box.appendChild(btn);
  });
}
async function locateMe() {
  if (!navigator.geolocation) return showError("Location unavailable.");
  setStatus("Finding you…");
  navigator.geolocation.getCurrentPosition((pos) => {
    origin = { lon: pos.coords.longitude, lat: pos.coords.latitude };
    originLabel = "Current location"; fromInput.value = "Current location";
    map.easeTo({ center: [origin.lon, origin.lat], zoom: 15.4, pitch: 60, duration: 900 });
    setStatus("");
  }, () => { showError("Allow location or type an address."); setStatus(""); }, { enableHighAccuracy: true, timeout: 8000 });
}
async function plan() {
  showError("");
  if (!origin) return showError("Set a start point.");
  if (!dest) return showError("Set a destination.");
  setStatus("Scoring the smoothest 3D line…");
  try {
    const raw = await requestRoutes(origin, dest);
    const trips = collectTrips(raw);
    if (!trips.length) throw new Error("No routes returned.");
    const scored = [];
    for (const trip of trips) {
      const shape = trip.legs.map((l) => l.shape).join("");
      const attrs = await requestTraceAttributes(shape);
      scored.push(scoreTrip(trip, attrs.edges ?? [], "miles"));
    }
    routes = rankRoutes(scored);
    selectedId = routes[0]?.id ?? "";
    paintRoutes(); renderDash(); renderSpeedRail(); bootDrive();
    setStatus(""); streak += 1; $("#stat-streak").textContent = String(streak);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Routing failed."); setStatus("");
  }
}
function paintRoutes() {
  addRouteLayers();
  const features = routes.map((r) => ({
    type: "Feature" as const,
    properties: { id: r.id, selected: r.id === selectedId },
    geometry: { type: "LineString" as const, coordinates: decodePolyline6(r.trip.legs.map((l) => l.shape).join("")) },
  }));
  (map.getSource("routes") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features });
  if (map.getLayer("route-glow")) map.setPaintProperty("route-glow", "line-color", TRAILS[garage.trail].line);
}
function renderDash() {
  dashEl.removeAttribute("hidden");
  const sel = routes.find((r) => r.id === selectedId);
  if (sel) { $("#stat-score").textContent = String(sel.slideScore); $("#stat-eta").textContent = arrivalClock(sel.durationSec); }
  routesEl.innerHTML = routes.map((r) => {
    const on = r.id === selectedId ? " selected" : "";
    return `<button class="route-option${on}" data-id="${r.id}"><div class="row"><span class="tag">${r.label} · ${r.slideScore}</span><b>${formatDuration(r.durationSec)}</b></div><div class="why">${formatMiles(r.distanceMi)} · ${r.turns} turns · ${r.why}</div></button>`;
  }).join("");
  routesEl.querySelectorAll<HTMLButtonElement>(".route-option").forEach((btn) => {
    btn.onclick = () => { selectedId = btn.dataset.id || selectedId; paintRoutes(); renderDash(); renderSpeedRail(); bootDrive(); };
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
  selectedCoords = decodePolyline6(route.trip.legs.map((l) => l.shape).join(""));
  if (!selectedCoords.length) return;
  chaseT = 0; spawnPlayer(); spawnGhosts();
  $("#speedo").removeAttribute("hidden");
  if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(tick); }
}
function carSvg(color: string, glow: string, ghost = false): string {
  const opacity = ghost ? 0.55 : 1;
  return `<svg viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glow}" stop-opacity=".9"/><stop offset="1" stop-color="${color}" stop-opacity="${opacity}"/></linearGradient></defs><ellipse cx="20" cy="58" rx="10" ry="4" fill="${glow}" opacity=".35"/><path d="M12 50 L20 8 L28 50 Z" fill="url(#g)" stroke="${glow}" stroke-width="1.4"/><path d="M16 28 L20 16 L24 28 Z" fill="#0b1218" opacity=".45"/></svg>`;
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
  const trails: GeoJSON.Feature[] = [];
  for (const g of ghosts) {
    const el = document.createElement("div");
    el.className = "ghost-marker"; el.style.color = g.color;
    el.innerHTML = `<div class="ghost-label">${g.tag}</div>${carSvg(g.color, g.color, true)}`;
    ghostMarkers.push(new maplibregl.Marker({ element: el, anchor: "center", pitchAlignment: "map", rotationAlignment: "map" }).setLngLat([g.samples[0].lon, g.samples[0].lat]).addTo(map));
    trails.push({ type: "Feature", properties: { color: g.color }, geometry: { type: "LineString", coordinates: g.samples.map((s) => [s.lon, s.lat]) } });
  }
  (map.getSource("ghost-trails") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: garage.showGhosts ? trails : [] });
}
function setGhostVisibility(show: boolean) {
  ghostMarkers.forEach((m) => { m.getElement().style.display = show ? "block" : "none"; });
}
function tick(ts: number) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts;
  if (selectedCoords.length) {
    chaseT = (chaseT + dt * 0.015) % 1;
    const you = chasePoint(selectedCoords, chaseT);
    playerMarker?.setLngLat([you.pos.lon, you.pos.lat]);
    playerMarker?.setRotation(you.bearing);
    const route = routes.find((r) => r.id === selectedId);
    const mph = route ? Math.round(route.distanceMi / Math.max(route.durationSec / 3600, 0.01)) : 0;
    $("#speed-n").textContent = String(mph).padStart(2, "0");
    if (garage.camera === "chase") map.jumpTo({ center: [you.pos.lon, you.pos.lat], bearing: you.bearing, pitch: 64, zoom: 16.4 });
    ghosts.forEach((g, i) => { const s = stepGhost(g, dt); ghostMarkers[i]?.setLngLat([s.lon, s.lat]); ghostMarkers[i]?.setRotation(s.bearing); });
    const lead = ghosts.length ? ((ghosts[0].t - chaseT) * (route?.durationSec ?? 0)).toFixed(1) : "0.0";
    $("#ghost-delta").textContent = ghosts.length ? `GHOST ${Number(lead) >= 0 ? "+" : ""}${lead}s` : "NO GHOSTS";
  }
  raf = requestAnimationFrame(tick);
}
function setStatus(text: string) { statusEl.textContent = text; statusEl.classList.toggle("show", Boolean(text)); }
function showError(text: string) { errorEl.textContent = text; errorEl.toggleAttribute("hidden", !text); }
function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]!)); }
persist();
