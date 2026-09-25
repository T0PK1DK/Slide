import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { decodePolyline6, haversineMeters } from "./lib/polyline";
import {
  requestRouteVariant,
  requestTraceAttributes,
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
  viaLine,
  type SlideRoute,
} from "./lib/smooth";
import { loadGarage, saveGarage, TRAILS, type GarageConfig, type SavedPlace } from "./lib/garage";
import { bubbleCandidates, mergeVariantTrips, pickFree, tollLabel, variantsFor } from "./plan/routeset";
import { dropIndex, MAX_STOPS, moveItem, stopsReached } from "./plan/stops";
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
import { ensureSignedIn, lockApp } from "./hud/login";
import { createYouMarker } from "./map/you";
import { mountCommand } from "./hud/command";
import { recordTrip } from "./lib/history";
import { loadProfile } from "./lib/profile";
import {
  cumulativeMiles,
  LOCATION_MESSAGES,
  snapToRoute,
  startTracking,
  type Fix,
  type LocationProblem,
  type RouteProgress,
  type TrackerHandle,
} from "./lib/tracking";

const MIAMI: LonLat = { lon: -80.1918, lat: 25.7617 };
const STYLE = "https://tiles.openfreemap.org/styles/dark";

let garage = loadGarage();
applyTheme(garage);

const app = document.querySelector("#app")!;
app.innerHTML = `
  <div id="map"></div>
  <div class="vignette"></div>
  <div class="hud">
    <button class="map-fab menu-fab plan-only" id="menu-fab" type="button" aria-label="Menu">☰</button>
    <button class="map-fab compass-fab plan-only" id="compass-fab" type="button" aria-label="North up">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3l4 14-4-2-4 2z" fill="currentColor"/></svg>
    </button>
    <button class="map-fab locate-fab plan-only" id="locate-fab" type="button" aria-label="Locate">⌖</button>
    <div class="panel search-card plan-only" id="search-card">
      <div class="brand desktop-only"><h1>Slide</h1><span class="chip" id="rank-chip">GARAGE</span><button class="icon" id="help" type="button" aria-label="How to Slide">?</button></div>
      <div class="where-row">
        <svg class="where-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="to" placeholder="Where to?" autocomplete="off" />
        <div class="suggest" id="to-suggest" hidden></div>
      </div>
      <div class="sheet-more">
        <div class="fields">
          <div class="field"><label>From</label><input id="from" value="Current location" placeholder="Current location or address" autocomplete="off" /><button type="button" class="use-gps" id="from-gps" aria-label="Start from my current location"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M21 3L3 10.5l7.5 2.9L13.4 21z" fill="currentColor"/></svg>Me</button><div class="suggest" id="from-suggest" hidden></div></div>
        </div>
        <div class="place-chips" id="place-chips">
          <button type="button" class="place-chip" id="chip-home">Home</button>
          <button type="button" class="place-chip" id="chip-work">Work</button>
          <button type="button" class="place-chip" id="chip-saved" hidden></button>
        </div>
        <div class="recents" id="recents" hidden></div>
        <div class="actions">
          <button class="primary" id="go">Drop the line</button>
          <button class="ghost" id="locate">Locate</button>
          <button class="icon" id="tune">Tune</button>
        </div>
        <div class="error" id="error" hidden></div>
      </div>
    </div>
    <div class="panel status-pill" id="status">Locking a 3D line…</div>
    <div class="panel loc-banner" id="loc-banner" role="alert" hidden>
      <p id="loc-msg"></p>
      <div class="loc-actions">
        <button class="ghost" id="loc-search" type="button">Search a start point instead</button>
        <button class="primary" id="loc-retry" type="button">Try again</button>
        <button class="icon loc-close" id="loc-close" type="button" aria-label="Dismiss">×</button>
      </div>
    </div>
    <div class="panel preview-chip drive-only" id="preview-chip" hidden>PREVIEW · simulated car, not your location</div>
    <div class="panel maneuver drive-only" id="maneuver" hidden>
      <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path id="man-arrow" d="" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="man-text"><b id="man-dist">—</b><span id="man-instr">—</span></div>
      <div class="man-bar"><i id="man-fill"></i></div>
    </div>
    <div class="panel posted-chip drive-only" id="posted" hidden></div>
    <div class="panel review-sheet review-only" id="review-sheet" hidden>
      <div class="review-head">
        <b id="review-eta">—</b>
        <span id="review-dist">—</span>
      </div>
      <p class="review-via" id="review-via">—</p>
      <p class="review-tag" id="review-tag">—</p>
      <p class="review-eta-note" id="review-eta-note">Typical time · no live traffic yet</p>
      <ol class="stops-list" id="stops-list" aria-label="Stops, in driving order"></ol>
      <div class="stop-search" id="stop-search" hidden>
        <input id="stop-input" placeholder="Add a stop" autocomplete="off" aria-label="Search for a stop" />
        <div class="suggest" id="stop-suggest" hidden></div>
      </div>
      <div class="review-tools">
        <button class="tool" id="review-add-stop" type="button">+ Add stop</button>
        <button class="tool icon" id="review-options" type="button" aria-label="Route options" aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>
        </button>
      </div>
      <div class="review-actions">
        <button class="ghost" id="review-back" type="button">Where to?</button>
        <button class="primary" id="review-go" type="button">Go now</button>
      </div>
      <button class="linkish" id="review-preview" type="button">Preview drive <span>· simulated, not saved</span></button>
    </div>
    <div class="panel options-sheet" id="route-options" role="dialog" aria-modal="true" aria-labelledby="ro-title" hidden>
      <h2 id="ro-title">Route options</h2>
      <label class="switch"><span>Avoid tolls<small>SunPass and toll roads</small></span><input type="checkbox" id="ro-tolls" /></label>
      <label class="switch"><span>Avoid highways</span><input type="checkbox" id="ro-highways" /></label>
      <label class="switch"><span>Avoid ferries</span><input type="checkbox" id="ro-ferries" /></label>
      <button class="primary" id="ro-done" type="button">Done</button>
    </div>
    <div class="panel arrival-sheet arrive-only" id="arrival" role="dialog" aria-labelledby="arr-dest" hidden>
      <span class="arr-kicker" id="arr-kicker">ARRIVED</span>
      <h2 id="arr-dest">—</h2>
      <div class="arr-stats">
        <div><span>Drive time</span><b id="arr-time">—</b></div>
        <div><span>Driven</span><b id="arr-dist">—</b></div>
        <div><span>Line</span><b id="arr-line">—</b></div>
      </div>
      <p class="arr-note" id="arr-note"></p>
      <button class="primary" id="arr-done" type="button">Done</button>
    </div>
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
        <div class="limit" id="limit" hidden><span>Speed limit</span><b id="limit-n">—</b></div>
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
      <button type="button" id="ov-insights">Drive insights</button>
      <button type="button" id="ov-lock">Lock Slide</button>
    </div>
    <div class="coach" id="coach" hidden>
      <div class="panel coach-card">
        <h2>How to Slide</h2>
        <ol>
          <li>Type <b>Where to?</b><span>Or tap Home / Work. Locate sets From.</span></li>
          <li>Slide drops the smoothest line<span>Tap <b>Go now</b>. Fastest is an explicit pick on the map.</span></li>
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
const you = createYouMarker(map);
/** Recorded into on-device history only when the drive ran on live GPS (never the preview car). */
type DriveLog = { startedAt: number; live: boolean; offRouteEvents: number; wasOff: boolean; drivenMi: number; lastPos: LonLat | null };
const freshLog = (): DriveLog => ({ startedAt: 0, live: false, offRouteEvents: 0, wasOff: false, drivenMi: 0, lastPos: null });
let driveLog = freshLog();
map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

let origin: LonLat | null = null;
let dest: LonLat | null = null;
let originLabel = "";
let destLabel = "";
let routes: SlideRoute[] = [];
/** Zoom the route bubbles were last laid out at; a real zoom change re-runs the overlap pass. */
let chipLayoutZoom = 0;
/** Stops between origin and destination, in driving order. Dropped as each is reached. */
let stops: SavedPlace[] = [];
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
/** True once the driver searched a specific From address; otherwise From is their live GPS position. */
let originPicked = false;
/** The simulated car runs only when the driver explicitly asked for a preview. */
let previewDrive = false;
let offSince = 0;
let lastRerouteAt = 0;
let rerouting = false;
let lastProblem: LocationProblem | null = null;
let disp: { lon: number; lat: number; bearing: number } | null = null;
const fixWaiters: Array<{ resolve: (f: Fix) => void; reject: (p: LocationProblem) => void }> = [];
const ARRIVE_M = 40;
const OFF_ROUTE_M = 60;
const REROUTE_AFTER_MS = 8000;

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
const reviewEl = $("#review-sheet");
const coachEl = $("#coach");
const overflowEl = $("#overflow");
const moreBtn = $("#more");
type HudMode = "plan" | "review" | "drive" | "arrive";
let hudMode: HudMode = "plan";

map.on("load", () => {
  performance.mark("slide-map-load");
  styleReady = true;
  liftNightBasemap(map);
  ensure3DBuildings();
  addRouteLayers();
  if (hudMode === "drive") applyCamera(garage.camera);
  else applyPlanView();
  styleQueue.splice(0).forEach((fn) => fn());
});
// Timing marks read by the load-time check (and handy in DevTools): style loaded, first full render.
map.once("idle", () => { performance.mark("slide-map-idle"); document.documentElement.dataset.map = "ready"; });
map.on("error", () => {
  // Tiles / style can 429. Keep the HUD usable; route paint still applies on a lifted land color.
});

bindSearch(fromInput, $("#from-suggest"), (hit) => {
  origin = { lon: hit.lon, lat: hit.lat };
  originLabel = hit.label;
  originPicked = true;
  fromInput.value = hit.label;
});
fromInput.addEventListener("focus", () => { if (!originPicked) fromInput.select(); });
fromInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!fromInput.value.trim()) useCurrentLocation();
    else if (!originPicked) fromInput.value = "Current location";
  }, 250);
});
$("#from-gps").addEventListener("click", useCurrentLocation);
bindSearch(toInput, $("#to-suggest"), (hit) => {
  dest = { lon: hit.lon, lat: hit.lat };
  destLabel = hit.label;
  toInput.value = hit.label;
  rememberRecent(hit);
  plan();
});
bindSearch($("#stop-input") as HTMLInputElement, $("#stop-suggest"), (hit) => {
  if (stops.length >= MAX_STOPS) return;
  stops.push({ label: hit.label, lon: hit.lon, lat: hit.lat });
  ($("#stop-input") as HTMLInputElement).value = "";
  $("#stop-search").setAttribute("hidden", "");
  renderStops();
  if (dest) void plan();
});
$("#review-add-stop").addEventListener("click", () => {
  $("#stop-search").removeAttribute("hidden");
  ($("#stop-input") as HTMLInputElement).focus();
});
const optionsEl = $("#route-options");
const avoidBoxes = { tolls: $("#ro-tolls"), highways: $("#ro-highways"), ferries: $("#ro-ferries") } as Record<keyof GarageConfig["avoid"], HTMLInputElement>;
$("#review-options").addEventListener("click", () => {
  for (const k of Object.keys(avoidBoxes) as Array<keyof GarageConfig["avoid"]>) avoidBoxes[k].checked = garage.avoid[k];
  optionsEl.removeAttribute("hidden");
  avoidBoxes.tolls.focus();
});
for (const k of Object.keys(avoidBoxes) as Array<keyof GarageConfig["avoid"]>) {
  avoidBoxes[k].addEventListener("change", () => { garage.avoid[k] = avoidBoxes[k].checked; persist(); });
}
$("#ro-done").addEventListener("click", () => {
  optionsEl.setAttribute("hidden", "");
  if (dest && (hudMode === "review" || hudMode === "plan")) void plan();
});
$("#locate").addEventListener("click", locateMe);
$("#loc-close").addEventListener("click", hideLocationProblem);
$("#loc-retry").addEventListener("click", () => {
  hideLocationProblem();
  if (hudMode === "plan" && dest) void plan();
  else startLocation({ center: hudMode === "plan" });
});
$("#loc-search").addEventListener("click", () => {
  hideLocationProblem();
  if (hudMode !== "plan") setHudMode("plan");
  $("#search-card").classList.add("open");
  fromInput.value = "";
  fromInput.focus();
});
$("#review-preview").addEventListener("click", () => startDrive(true));
$("#arr-done").addEventListener("click", finishArrival);
// The round FAB is "show me": it starts location or recentres on it, never switches it off.
$("#locate-fab").addEventListener("click", () => {
  if (!tracker) return locateMe();
  if (liveFix) map.easeTo({ center: [liveFix.pos.lon, liveFix.pos.lat], zoom: Math.max(map.getZoom(), 15), duration: 700 });
});
$("#menu-fab").addEventListener("click", () => {
  overflowEl.classList.toggle("open");
  overflowEl.classList.toggle("from-plan", overflowEl.classList.contains("open"));
});
$("#compass-fab").addEventListener("click", () => {
  followCamera = true;
  map.easeTo({ bearing: 0, pitch: window.innerWidth < 820 && hudMode === "plan" ? 8 : map.getPitch(), duration: 500 });
});
toInput.addEventListener("focus", () => $("#search-card").classList.add("open"));
$("#go").addEventListener("click", plan);
$("#tune").addEventListener("click", () => garageEl.classList.toggle("open"));
$("#g-close").addEventListener("click", () => garageEl.classList.remove("open"));
recenterEl.addEventListener("click", () => {
  followCamera = true;
  recenterEl.setAttribute("hidden", "");
  if (hudMode !== "drive") fitToRoute();
});
$("#review-go").addEventListener("click", () => startDrive(false));
$("#review-back").addEventListener("click", backToSearch);
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
$("#ov-lock").addEventListener("click", lockApp);
map.on("moveend", () => {
  if ((hudMode === "review" || hudMode === "plan") && routes.length && Math.abs(map.getZoom() - chipLayoutZoom) > 0.25) paintRouteChips();
});
const command = mountCommand({
  map,
  driverName: () => loadProfile()?.name ?? "",
  onSearch: () => { $("#search-card").classList.add("open"); toInput.focus(); },
  onGarage: () => garageEl.classList.add("open"),
  onLocate: () => { if (!tracker) locateMe(); else if (liveFix) map.easeTo({ center: [liveFix.pos.lon, liveFix.pos.lat], zoom: 15, duration: 700 }); },
  onSelectRoute: (id) => selectRoute(id),
});
$("#ov-insights").addEventListener("click", () => { overflowEl.classList.remove("open"); command.openSheet(true); });
$("#chip-home").addEventListener("click", () => useOrSavePlace("home"));
$("#chip-work").addEventListener("click", () => useOrSavePlace("work"));
$("#chip-saved").addEventListener("click", () => {
  const saved = savedChipPlace();
  if (!saved) return;
  dest = { lon: saved.lon, lat: saved.lat };
  destLabel = saved.label;
  toInput.value = saved.label;
  showError("");
  plan();
});
$("#search-card").addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("button") || t.closest("input") || t.closest(".suggest")) return;
  toInput.focus();
});
window.addEventListener("resize", () => {
  map.resize();
  if (hudMode === "review") fitToRoute();
});
/** A hand on the map pauses follow in every camera mode; the Recenter pill brings it back. */
function pauseFollow(e: { originalEvent?: unknown }) {
  if (hudMode !== "drive" || !e.originalEvent) return;
  followCamera = false;
  recenterEl.removeAttribute("hidden");
}
// followDriver() calls jumpTo every frame, which cancels MapLibre's own drag
// handlers before "dragstart" can fire — so also watch the raw gesture.
{
  const box = map.getCanvasContainer();
  let down: { x: number; y: number } | null = null;
  box.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  box.addEventListener("pointermove", (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) pauseFollow({ originalEvent: e });
  });
  const lift = () => { down = null; };
  box.addEventListener("pointerup", lift);
  box.addEventListener("pointercancel", lift);
  box.addEventListener("wheel", (e) => pauseFollow({ originalEvent: e }), { passive: true });
  box.addEventListener("touchstart", (e) => { if (e.touches.length > 1) pauseFollow({ originalEvent: e }); }, { passive: true });
}
map.on("dragstart", pauseFollow);
map.on("zoomstart", pauseFollow);
map.on("rotatestart", pauseFollow);
map.on("pitchstart", pauseFollow);
document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (!t.closest(".field") && !t.closest(".where-row")) document.querySelectorAll<HTMLElement>(".suggest").forEach((b) => { b.hidden = true; });
  if (!t.closest("#search-card") && !t.closest("#menu-fab") && !t.closest(".overflow")) {
    $("#search-card").classList.remove("open");
    if (!t.closest("#more")) overflowEl.classList.remove("open", "from-plan");
  }
});
toInput.addEventListener("keydown", (e) => { if (e.key === "Enter") plan(); });
wireGarage();
refreshPlaceChips();
renderRecents();
setHudMode("plan");
ensureSignedIn(document.body, (driver) => {
  // A new driver's car tag seeds the garage; after that the garage tag is theirs to change.
  if (garage.tag === "SLIDE-01" && driver.tag !== "SLIDE-01") {
    garage.tag = driver.tag;
    persist();
    const tagInput = document.querySelector<HTMLInputElement>("#g-tag");
    if (tagInput) tagInput.value = garage.tag;
  }
  command.refreshHistory();
  if (!garage.coachDismissed) showCoach(true);
  void autoLocate();
});

/** Show the driver on the map at launch, but only if they've already allowed location — never a surprise prompt. */
async function autoLocate() {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (status?.state === "granted" && !tracker) startLocation({ center: true });
  } catch {
    // Permissions API missing (older Safari): wait for the Locate button.
  }
}

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
  const chip = document.querySelector("#rank-chip");
  if (chip) chip.textContent = garage.tag;
  refreshPlaceChips();
}
function rememberRecent(hit: { label: string; lon: number; lat: number }) {
  const recents = [
    { label: hit.label, lon: hit.lon, lat: hit.lat },
    ...(garage.recents ?? []).filter((r) => r.label !== hit.label),
  ].slice(0, 4);
  garage.recents = recents;
  persist();
  renderRecents();
}
function renderRecents() {
  const box = $("#recents");
  const items = garage.recents ?? [];
  if (!items.length) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  box.innerHTML = `<div class="recents-label">Recent</div>${items.map((r) => `<button type="button" class="recent-item" data-lon="${r.lon}" data-lat="${r.lat}">${esc(r.label)}</button>`).join("")}`;
  box.querySelectorAll<HTMLButtonElement>(".recent-item").forEach((btn) => {
    btn.onclick = () => {
      dest = { lon: Number(btn.dataset.lon), lat: Number(btn.dataset.lat) };
      destLabel = btn.textContent || "";
      toInput.value = destLabel;
      plan();
    };
  });
}
/** From = the driver's live position. Clears any searched start point. */
function useCurrentLocation() {
  originPicked = false;
  origin = liveFix?.pos ?? null;
  originLabel = "Current location";
  fromInput.value = "Current location";
}
/**
 * The start point for a plan: a searched address if the driver picked one,
 * otherwise a real GPS fix. Never the map centre — if there's no fix, the
 * driver gets told why and can search a start point instead.
 */
async function resolveOrigin(): Promise<LonLat | null> {
  if (originPicked && origin) return origin;
  if (liveFix && Date.now() - liveFix.at < 30_000) return liveFix.pos;
  setStatus("Finding you…");
  try {
    const fix = await waitForFix(15_000);
    return fix.pos;
  } catch (problem) {
    showLocationProblem(problem as LocationProblem);
    return null;
  } finally {
    setStatus("");
  }
}
function waitForFix(ms: number): Promise<Fix> {
  if (liveFix && Date.now() - liveFix.at < 30_000) return Promise.resolve(liveFix);
  return new Promise<Fix>((resolve, reject) => {
    const waiter = {
      resolve: (f: Fix) => { window.clearTimeout(timer); resolve(f); },
      reject: (p: LocationProblem) => { window.clearTimeout(timer); reject(p); },
    };
    const timer = window.setTimeout(() => {
      const i = fixWaiters.indexOf(waiter);
      if (i >= 0) fixWaiters.splice(i, 1);
      reject(lastProblem === "unavailable" ? "unavailable" : "timeout");
    }, ms);
    fixWaiters.push(waiter);
    startLocation({ center: false });
  });
}
function showLocationProblem(problem: LocationProblem) {
  $("#loc-msg").textContent = LOCATION_MESSAGES[problem];
  // Mid-drive there's no start point to search; the drive just waits for GPS.
  $("#loc-search").toggleAttribute("hidden", hudMode === "drive");
  $("#loc-banner").removeAttribute("hidden");
}
function hideLocationProblem() {
  $("#loc-banner").setAttribute("hidden", "");
}
function applyPlanView() {
  const phone = window.innerWidth < 820;
  toggleBuildings(phone ? false : garage.showBuildings);
  if (phone) map.easeTo({ pitch: 8, bearing: 0, zoom: Math.max(map.getZoom(), 11.3), duration: 700 });
  else applyCamera(garage.camera);
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
    plan();
    return;
  }
  savePlace(slot);
}
function savedChipPlace() {
  const skip = new Set([garage.home?.label, garage.work?.label].filter(Boolean) as string[]);
  return (garage.recents ?? []).find((r) => !skip.has(r.label)) ?? null;
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
  // "401, Bayside Marketplace, …" → "Bayside Marketplace": skip a bare house number.
  extra.textContent = saved ? (saved.label.split(",").map((x) => x.trim()).find((x) => x && !/^\d+[a-z]?$/i.test(x)) ?? saved.label) : "";
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
  paintSwatches($("#g-glow"), ["#f0a04b","#78e0c8","#b388ff","#8fd3ff","#d6ff3c"], garage.glow, (c) => { garage.glow = c; persist(); });
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
function setHudMode(mode: HudMode) {
  hudMode = mode;
  document.body.dataset.mode = mode;
  const driving = mode === "drive";
  you.setVisible(!driving);
  const reviewing = mode === "review";
  driveBarEl.toggleAttribute("hidden", !driving);
  reviewEl.toggleAttribute("hidden", !reviewing);
  $("#arrival").toggleAttribute("hidden", mode !== "arrive");
  if (!driving) $("#preview-chip").setAttribute("hidden", "");
  if (driving) {
    speedsEl.setAttribute("hidden", "");
    toggleBuildings(garage.showBuildings);
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
    // Drive: the camera follows the car from tick(); Arrival frames the destination itself.
    if (reviewing) fitToRoute();
    else if (mode === "plan") applyPlanView();
  });
}
/** Go = real GPS. The simulated car only runs from the explicit "Preview drive" button. */
function startDrive(preview = false) {
  if (!routes.length) return;
  previewDrive = preview;
  driveLog = { ...freshLog(), startedAt: Date.now() };
  offSince = 0;
  disp = null;
  followCamera = true;
  hideLocationProblem();
  renderSpeedRail();
  bootDrive();
  setHudMode("drive");
  $("#preview-chip").toggleAttribute("hidden", !preview);
  if (!preview) {
    startLocation({ center: false });
    if (!liveFix) setStatus("Waiting for GPS…");
  }
  streak += 1;
  $("#stat-streak").textContent = String(streak);
}
function stopDriveLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  disp = null;
  offSince = 0;
  // followDriver() pads the camera so the car sits low; plan and review framing expect none.
  map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  playerMarker?.remove();
  playerMarker = null;
  ghostMarkers.forEach((m) => m.remove());
  ghostMarkers = [];
}
function endDrive() {
  saveDriveToHistory();
  stopDriveLoop();
  followCamera = true;
  previewDrive = false;
  setOffRoute(false);
  setStatus("");
  if (routes.length) {
    loadSelectedRoute();
    paintRouteChips();
    renderReview();
    setHudMode("review");
  } else {
    setHudMode("plan");
  }
}
/** Within ~40 m of the destination: stop live guidance and show the Arrival screen (DESIGN.md 07). */
function arrive() {
  const route = routes.find((r) => r.id === selectedId);
  const startedAt = driveLog.startedAt;
  const drivenMi = driveLog.drivenMi;
  saveDriveToHistory();
  stopDriveLoop();
  setOffRoute(false);
  setStatus("");
  followCamera = true;
  const now = new Date();
  $("#arr-kicker").textContent = `ARRIVED · ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  $("#arr-dest").textContent = destLabel || "Destination";
  $("#arr-time").textContent = startedAt ? formatDuration((now.getTime() - startedAt) / 1000) : "—";
  $("#arr-dist").textContent = formatMiles(drivenMi);
  $("#arr-line").textContent = route?.label ?? "—";
  $("#arr-note").textContent = drivenMi >= 0.2 ? "Saved to Your trips on this phone." : "Short drive — not saved to Your trips.";
  setHudMode("arrive");
  if (dest) map.easeTo({ center: [dest.lon, dest.lat], zoom: 16, pitch: 30, bearing: 0, duration: 900 });
}
function finishArrival() {
  routes = [];
  stops = [];
  selectedId = "";
  selectedCoords = [];
  dest = null;
  destLabel = "";
  toInput.value = "";
  paintRoutes();
  dashEl.setAttribute("hidden", "");
  setHudMode("plan");
}
function saveDriveToHistory() {
  const route = routes.find((r) => r.id === selectedId);
  // Preview drives (the simulated car) and false starts are never recorded.
  const log = driveLog;
  driveLog = freshLog();
  if (!route || previewDrive || !log.live || log.drivenMi < 0.2 || !log.startedAt) return;
  const step = Math.max(1, Math.floor(route.bands.length / 24));
  recordTrip({
    id: `t${log.startedAt}`,
    startedAt: log.startedAt,
    endedAt: Date.now(),
    destLabel,
    routeLabel: route.label,
    distanceMi: Math.round(log.drivenMi * 100) / 100,
    plannedSec: route.durationSec,
    actualSec: Math.round((Date.now() - log.startedAt) / 1000),
    slideScore: route.slideScore,
    lefts: route.lefts,
    offRouteEvents: log.offRouteEvents,
    postedProfile: route.bands.filter((_, i) => i % step === 0).map((b) => b.postedMph ?? b.expectedMph),
  });
  command.refreshHistory();
}
function backToSearch() {
  followCamera = true;
  $("#search-card").classList.add("open");
  setHudMode("plan");
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
  // The selected line draws above the alternates wherever they overlap.
  const layout = { ...LINE_LAYOUT, "line-sort-key": ["case", ["get", "selected"], 1, 0] } as never;
  map.addLayer({ id: "route-glow", type: "line", source: "routes", layout, paint: paint.glow as never });
  map.addLayer({ id: "route-case", type: "line", source: "routes", layout, paint: paint.case as never });
  map.addLayer({ id: "route-line", type: "line", source: "routes", layout, paint: paint.line as never });
  map.addLayer({ id: "route-core", type: "line", source: "routes", layout, paint: paint.core as never });
  // Invisible fat line so a thumb can pick an alternate by tapping it, not just its bubble.
  map.addLayer({ id: "route-hit", type: "line", source: "routes", layout: LINE_LAYOUT, paint: { "line-color": "#000", "line-opacity": 0, "line-width": 28 } });
  map.on("click", "route-hit", (e) => {
    if (hudMode !== "review" && hudMode !== "plan") return;
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "string" && id !== selectedId) selectRoute(id);
  });
  map.on("mouseenter", "route-hit", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "route-hit", () => { map.getCanvas().style.cursor = ""; });
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
  you.remove();
  $("#locate").classList.remove("on");
  $("#locate").textContent = "Locate";
}
/** Start the live GPS watch if it isn't running. Never toggles it off. */
function startLocation(opts: { center: boolean }) {
  if (tracker) return;
  $("#locate").classList.add("on");
  $("#locate").textContent = "Tracking";
  let first = opts.center;
  tracker = startTracking(
    (fix) => {
      liveFix = fix;
      lastProblem = null;
      you.update(fix);
      if (!originPicked) { origin = fix.pos; fromInput.value = document.activeElement === fromInput ? fromInput.value : "Current location"; }
      if (!$("#loc-banner").hasAttribute("hidden") && hudMode === "drive") hideLocationProblem();
      fixWaiters.splice(0).forEach((w) => w.resolve(fix));
      if (hudMode === "drive" && !previewDrive) {
        if (statusEl.textContent === "Waiting for GPS…") setStatus("");
        const prev = driveLog.lastPos;
        // Count real distance between fixes; skip junk fixes and teleports.
        if (fix.accuracyM <= 100) {
          if (prev) {
            const m = haversineMeters(prev.lon, prev.lat, fix.pos.lon, fix.pos.lat);
            if (m < 500) driveLog.drivenMi += m / 1609.344;
          }
          driveLog.lastPos = fix.pos;
        }
      }
      if (!first) return;
      first = false;
      if (hudMode === "drive") return;
      const phonePlan = window.innerWidth < 820;
      map.easeTo({
        center: [fix.pos.lon, fix.pos.lat],
        zoom: phonePlan ? 13.6 : 15.4,
        pitch: phonePlan ? 8 : 60,
        bearing: phonePlan ? 0 : map.getBearing(),
        duration: 900,
      });
    },
    (problem) => {
      lastProblem = problem;
      if (problem === "denied" || problem === "insecure") {
        fixWaiters.splice(0).forEach((w) => w.reject(problem));
        stopTracking();
        setStatus("");
        showLocationProblem(problem);
      } else if (hudMode === "drive" && !previewDrive) {
        showLocationProblem(problem);
      } else if (!fixWaiters.length && !liveFix) {
        showLocationProblem(problem);
      }
    }
  );
}
/** Locate button: toggles the live GPS watch — the speedo reads real mph while this is on. */
function locateMe() {
  if (tracker) { stopTracking(); setStatus(""); return; }
  hideLocationProblem();
  if (!liveFix) setStatus("Finding you…");
  startLocation({ center: true });
  const clear = () => { if (statusEl.textContent === "Finding you…") setStatus(""); };
  waitForFix(15_000).then(clear, (p: LocationProblem) => { clear(); showLocationProblem(p); });
}
/** Ask Valhalla for lines between two points, score each one, and rank them (Slide first). */
async function fetchRanked(from: LonLat, to: LonLat): Promise<SlideRoute[]> {
  // Slide, Fastest and No-tolls costings in parallel, so there are real
  // alternatives even when Valhalla returns only one line per request.
  const points = [from, ...stops.map((s) => ({ lon: s.lon, lat: s.lat })), to];
  const results = await Promise.allSettled(
    variantsFor(garage.avoid.tolls).map((v) => requestRouteVariant(points, v, garage.avoid))
  );
  const trips = mergeVariantTrips(results);
  if (!trips.length) {
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw failed ? failed.reason : new Error("No routes returned.");
  }
  const scored = await Promise.all(trips.map(async (trip) => {
    const attrs = await requestTraceAttributes(tripShape(trip));
    return scoreTrip(trip, attrs.edges ?? [], "miles");
  }));
  return rankRoutes(scored);
}
async function plan() {
  if (planning) return;
  showError("");
  hideLocationProblem();
  if (!dest) return showError("Set a destination.");
  planning = true;
  const goBtn = $("#go") as HTMLButtonElement;
  goBtn.disabled = true;
  try {
    const start = await resolveOrigin();
    if (!start) return;
    origin = start;
    if (!originPicked) originLabel = "Current location";
    setStatus("Scoring the smoothest 3D line…");
    routes = await fetchRanked(start, dest);
    selectedId = routes[0]?.id ?? "";
    loadSelectedRoute();
    paintRoutes();
    renderDash();
    renderReview();
    setHudMode("review");
    setStatus("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Routing failed.";
    $("#search-card").classList.add("open");
    showError(/failed|network|fetch|load|abort|\d{3}/i.test(msg) ? "Can't reach routing right now. Check your connection and try again." : msg);
    setStatus("");
  } finally {
    planning = false;
    goBtn.disabled = false;
  }
}
/** Off the line for ~8 s while moving: re-plan from this fix to the same destination, same ranking. */
async function reroute(from: LonLat) {
  if (!dest || rerouting) return;
  rerouting = true;
  lastRerouteAt = performance.now();
  setStatus("Off the line — finding a new Slide route…");
  try {
    const next = await fetchRanked(from, dest);
    if (hudMode !== "drive" || previewDrive || !next.length) return;
    routes = next;
    selectedId = routes[0].id;
    origin = from;
    originLabel = "Current location";
    loadDriveRoute();
    paintRoutes();
    renderDash();
    spawnGhosts();
    offSince = 0;
    setOffRoute(false);
    setStatus("New Slide line");
    window.setTimeout(() => { if (statusEl.textContent === "New Slide line") setStatus(""); }, 2500);
  } catch {
    setStatus("Can't reach routing to reroute — retrying shortly.");
  } finally {
    rerouting = false;
  }
}
function fitToRoute() {
  if (!selectedCoords.length) return;
  whenStyleReady(() => {
    const bounds = new maplibregl.LngLatBounds(selectedCoords[0], selectedCoords[0]);
    for (const c of selectedCoords) bounds.extend(c);
    followCamera = true;
    const phone = window.innerWidth < 820;
    const reviewing = hudMode === "review";
    map.fitBounds(bounds, {
      padding: hudFitPadding(),
      pitch: reviewing ? (phone ? 8 : 18) : phone ? 48 : 52,
      bearing: reviewing ? 0 : -18,
      maxZoom: reviewing ? (phone ? 13.6 : 14.2) : phone ? 15.2 : 15.4,
      duration: 1100,
    });
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
    bootDrive();
    fitToRoute();
  } else if (hudMode === "review") {
    fitToRoute();
  }
}
function paintRoutes() {
  command.setRoutes(routes, selectedId);
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
  // One chip even when Valhalla found a single line, so the time sits on the route like any alternative.
  if (hudMode === "drive" || hudMode === "arrive" || !routes.length) return;
  // Selected route claims its spot first; the others avoid overlapping it on screen.
  const placed: Array<{ x: number; y: number }> = [];
  chipLayoutZoom = map.getZoom();
  const selectedFirst = [...routes].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
  selectedFirst.forEach((r) => {
    const coords = decodePolyline6(tripShape(r.trip));
    if (!coords.length) return;
    const el = document.createElement("button");
    el.className = "route-chip" + (r.id === selectedId ? " on" : "");
    el.type = "button";
    const toll = tollLabel(r.hasToll);
    const tag = r.tags[0] ?? "";
    const showToll = toll && tag !== "No tolls";
    el.innerHTML = `<b>${formatDuration(r.durationSec)}</b>${tag ? `<span>${tag}</span>` : ""}${showToll ? `<em class="${r.hasToll ? "toll" : "free"}">${toll}</em>` : ""}`;
    el.setAttribute("aria-label", [...new Set([formatDuration(r.durationSec), ...r.tags, toll].filter(Boolean))].join(", "));
    el.onclick = (ev) => { ev.stopPropagation(); selectRoute(r.id); };
    const others = routes.filter((o) => o.id !== r.id).map((o) => decodePolyline6(tripShape(o.trip)));
    const cands = bubbleCandidates(coords, others);
    const at = cands[pickFree(cands.map((c) => map.project(c)), placed)];
    placed.push(map.project(at));
    routeChips.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(at).addTo(map));
  });
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
  const toll = tollLabel(sel.hasToll);
  const head = routes.length === 1 || sel.tags.length === 2
    ? "Slide pick · Fastest is also the smoothest line we found"
    : [sel.tags.join(" · ") || sel.label, shortWhy].filter(Boolean).join(" · ");
  $("#review-tag").textContent = toll && !sel.tags.includes("No tolls") ? `${head} · ${toll}` : head;
  renderStops();
}
/** Stops as a reorderable list: drag the grip (pointer events, so it works on touch too) or remove. */
function renderStops() {
  const list = $("#stops-list");
  list.innerHTML = stops.map((st, i) => `<li data-i="${i}"><span class="grip" aria-hidden="true">⋮⋮</span><span class="stop-n">${i + 1}</span><span class="stop-label">${esc(st.label)}</span><button type="button" class="stop-x" data-x="${i}" aria-label="Remove stop ${i + 1}, ${esc(st.label)}">×</button></li>`).join("");
  list.toggleAttribute("hidden", !stops.length);
  ($("#review-add-stop") as HTMLButtonElement).disabled = stops.length >= MAX_STOPS;
  list.querySelectorAll<HTMLButtonElement>(".stop-x").forEach((b) => b.addEventListener("click", () => {
    stops.splice(Number(b.dataset.x), 1);
    renderStops();
    if (dest) void plan();
  }));
  list.querySelectorAll<HTMLElement>(".grip").forEach((grip) => grip.addEventListener("pointerdown", (e) => {
    const row = grip.parentElement as HTMLElement;
    const from = Number(row.dataset.i);
    const rows = [...list.children] as HTMLElement[];
    const startY = e.clientY;
    row.classList.add("dragging");
    grip.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => { row.style.transform = `translateY(${ev.clientY - startY}px)`; };
    const up = (ev: PointerEvent) => {
      grip.removeEventListener("pointermove", move);
      row.classList.remove("dragging");
      row.style.transform = "";
      const mids = rows.filter((r) => r !== row).map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
      const to = dropIndex(ev.clientY, mids);
      if (to !== from) {
        stops = moveItem(stops, from, to);
        renderStops();
        if (dest) void plan();
      }
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up as EventListener, { once: true });
  }));
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
  speedsEl.innerHTML = `<h2>${originLabel || "Start"} → ${destLabel || "End"} · posted ${Math.round(route.postedCoverage * 100)}%</h2><div class="bands">${route.bands.map((b) => `<div class="band"><div class="name">${esc(b.name)}</div><div class="spd">${b.postedMph ?? "—"} <small>posted</small></div><div class="sub">expect ${b.expectedMph || "—"} · ${formatMiles(b.toMi - b.fromMi)}</div></div>`).join("")}</div>`;
  if (hudMode === "plan") speedsEl.removeAttribute("hidden");
  else speedsEl.setAttribute("hidden", "");
}
function loadSelectedRoute() {
  const route = routes.find((r) => r.id === selectedId);
  selectedCoords = route ? decodePolyline6(tripShape(route.trip)) : [];
  return route;
}
/** Point the drive at the selected line: shape, cumulative miles, guidance steps. */
function loadDriveRoute() {
  const route = loadSelectedRoute();
  if (!route || !selectedCoords.length) return null;
  cumulative = cumulativeMiles(selectedCoords);
  steps = buildSteps(route.maneuvers);
  progressMi = 0;
  return route;
}
function bootDrive() {
  if (!loadDriveRoute()) return;
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
  let target: { pos: LonLat; bearing: number } | null = null;
  let mph: number | null = null;

  if (previewDrive) {
    // Explicit preview only: a simulated car laps the line. Never saved, never a fallback.
    chaseT = (chaseT + dt * 0.015) % 1;
    target = chasePoint(selectedCoords, chaseT);
    progressMi = chaseT * totalMi;
    mph = route ? Math.round(route.distanceMi / Math.max(route.durationSec / 3600, 0.01)) : 0;
  } else if (liveFix) {
    // Real position wins: snap the fix to the planned line so the marker tracks
    // the road rather than drifting into the buildings beside it.
    const snap = snapToRoute(selectedCoords, cumulative, liveFix.pos);
    const off = snap ? snap.offRouteM > OFF_ROUTE_M : false;
    if (snap && !off) {
      progressMi = snap.alongMi;
      target = { pos: snap.snapped, bearing: snap.bearing };
    } else {
      target = { pos: liveFix.pos, bearing: liveFix.headingDeg ?? disp?.bearing ?? snap?.bearing ?? 0 };
    }
    setOffRoute(off);
    checkReroute(off, liveFix);
    mph = Math.round(liveFix.speedMph);
    driveLog.live = true;
    if (checkArrival(snap, totalMi)) return;
  }

  const el = playerMarker?.getElement();
  if (target) {
    if (!disp || previewDrive) {
      disp = { lon: target.pos.lon, lat: target.pos.lat, bearing: target.bearing };
    } else {
      // GPS lands about once a second; glide between fixes instead of jumping.
      const k = 1 - Math.exp(-dt * 5);
      disp.lon += (target.pos.lon - disp.lon) * k;
      disp.lat += (target.pos.lat - disp.lat) * k;
      const db = ((target.bearing - disp.bearing + 540) % 360) - 180;
      disp.bearing = (disp.bearing + db * k + 360) % 360;
    }
    if (el) el.style.visibility = "";
    playerMarker?.setLngLat([disp.lon, disp.lat]);
    playerMarker?.setRotation(disp.bearing);
    if (followCamera && hudMode === "drive") followDriver(disp);
  } else if (el) {
    // Live drive with no fix yet: no car on the map rather than a pretend one.
    el.style.visibility = "hidden";
  }
  $("#speed-n").textContent = mph === null ? "—" : String(mph);
  $("#speed-src").textContent = previewDrive ? "Est" : "MPH";

  renderGuidance(progressMi, mph ?? 0);
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
/** Keep the car in frame in every camera mode. Sits low on screen so the road ahead shows. */
function followDriver(p: { lon: number; lat: number; bearing: number }) {
  const h = map.getContainer().clientHeight;
  const center: [number, number] = [p.lon, p.lat];
  if (garage.camera === "top") {
    map.jumpTo({ center, bearing: 0, pitch: 0, zoom: 16, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
  } else if (garage.camera === "chase") {
    map.jumpTo({ center, bearing: p.bearing, pitch: 64, zoom: 16.6, padding: { top: Math.round(h * 0.38), bottom: 0, left: 0, right: 0 } });
  } else {
    map.jumpTo({ center, bearing: p.bearing, pitch: 55, zoom: 15.8, padding: { top: Math.round(h * 0.3), bottom: 0, left: 0, right: 0 } });
  }
}
function checkReroute(off: boolean, fix: Fix) {
  const moving = fix.speedMph >= 3;
  if (!off || !moving) { offSince = 0; return; }
  const now = performance.now();
  if (!offSince) offSince = now;
  if (now - offSince >= REROUTE_AFTER_MS && !rerouting && now - lastRerouteAt > 12_000 && liveFix) {
    void reroute(liveFix.pos);
  }
}
function checkArrival(snap: RouteProgress | null, totalMi: number): boolean {
  if (!dest || !liveFix) return false;
  if (stopsReached(stops, liveFix.pos)) {
    const done = stops.shift();
    renderStops();
    setStatus(`Stop reached: ${done?.label ?? "stop"}${stops.length ? " · on to the next" : ""}`);
    window.setTimeout(() => setStatus(""), 3000);
  }
  const toDestM = haversineMeters(liveFix.pos.lon, liveFix.pos.lat, dest.lon, dest.lat);
  const onLineAtEnd = Boolean(snap && snap.offRouteM <= OFF_ROUTE_M && totalMi > 0 && snap.alongMi / totalMi >= 0.99 && totalMi - snap.alongMi <= 0.05);
  if (toDestM > ARRIVE_M && !onLineAtEnd) return false;
  arrive();
  return true;
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
  if (off && !driveLog.wasOff) driveLog.offRouteEvents += 1;
  driveLog.wasOff = off;
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
// Installable app shell (Add to Home Screen). Production only, so dev reloads stay uncached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
