import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { decodePolyline6, haversineMeters } from "./lib/polyline";
import {
  requestRouteVariant,
  type RouteResponse,
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
import { LIVERIES, LIVERY_LABEL, VEHICLES, vehicleById, vehicleSvg, type Livery, type VehicleId } from "./lib/vehicles";
import { loadGarage, saveGarage, TRAILS, type GarageConfig, type Look, type SavedPlace } from "./lib/garage";
import { bubbleCandidates, mergeVariantTrips, pickFree, tollLabel, variantsFor } from "./plan/routeset";
import { dropIndex, MAX_STOPS, moveItem, stopsReached } from "./plan/stops";
import { classifyFailure, type FailWhat } from "./plan/failure";
import { cardAriaLabel, routeCards } from "./plan/review-cards";
import { EMPTY } from "./lib/empty";
import { splitPlaceLabel } from "./lib/place";
import { mountVoiceMute } from "./hud/voice-mute";
import { resetVoice, startVoice, stopVoice, tickVoice } from "./voice";
import { stepGhost, type GhostCar } from "./lib/ghosts";
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
import { lockApp } from "./hud/login";
import { driverReady, STYLE } from "./boot";
import { warmedStyle } from "./map/warm";
import { mountProfile } from "./hud/profile";
import { setSocialNotice } from "./hud/social";
import { cloudConfigured } from "./lib/cloud";
import { finishEmailLink } from "./lib/social";
import { ago, type RadarItem } from "./lib/reports";
import { mountRadar } from "./hud/radar";
import { mountFriends } from "./map/friends";
import { mountTraffic } from "./map/traffic";
import type { Alert } from "./lib/alerts";
import type { TrafficSummary } from "./lib/traffic";
import { createYouMarker } from "./map/you";
import { mountCommand } from "./hud/command";
import { recordTrip } from "./lib/history";
import { loadProfile } from "./lib/profile";
import {
  cumulativeMiles,
  LOCATION_MESSAGES,
  LOCATION_TITLES,
  snapToRoute,
  startTracking,
  type Fix,
  type LocationProblem,
  type RouteProgress,
  type TrackerHandle,
} from "./lib/tracking";
import { mountLaneStrip, renderLaneStrip } from "./lanes";

const MIAMI: LonLat = { lon: -80.1918, lat: 25.7617 };

let garage = loadGarage();
applyTheme(garage);
// The HUD markup (#app) and the login gate were already painted by boot.ts.


const map = new maplibregl.Map({
  container: "map",
  // The style JSON boot already fetched (no second request); the URL if it hasn't landed yet.
  style: (warmedStyle() as maplibregl.StyleSpecification | null) ?? STYLE,
  center: [MIAMI.lon, MIAMI.lat],
  zoom: 14.2,
  // Phones start in the flat plan view applyPlanView() eases to anyway: far fewer
  // tiles for the first render than a 58° tilt on a slow connection.
  pitch: window.innerWidth < 820 ? 8 : 58,
  bearing: window.innerWidth < 820 ? 0 : -18,
  attributionControl: false,
  maxPitch: 75,
});
/** Garage paints (game palette). */
const PAINTS = ["#e8eef2", "#111318", "#d7263d", "#ff8a4c", "#f6c945", "#3ddc84", "#2f7cff", "#b388ff", "#7cf0d8", "#8fd3ff"];
const you = createYouMarker(map);
you.setCar(carSvg(garage.carColor, garage.glow));
/** Recorded into on-device history only when the drive ran on live GPS (never a false start). */
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
let offSince = 0;
let lastRerouteAt = 0;
let rerouting = false;
let lastProblem: LocationProblem | null = null;
let disp: { lon: number; lat: number; bearing: number } | null = null;
const fixWaiters: Array<{ resolve: (f: Fix) => void; reject: (p: LocationProblem) => void }> = [];
const ARRIVE_M = 40;
const OFF_ROUTE_M = 60;
const REROUTE_AFTER_MS = 8000;
let lastTraffic: TrafficSummary = { line: null, etaNote: "Typical time · no live traffic yet", delaySec: 0, live: false };

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
  liftNightBasemap(map, garage.look);
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
  rememberRecent(hit);
  openPlace(hit);
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
$("#net-close").addEventListener("click", hideFailure);
$("#net-retry").addEventListener("click", () => { const again = netRetry; hideFailure(); again?.(); });
window.addEventListener("online", () => {
  const sheet = $("#net-sheet");
  if (sheet.hidden || sheet.dataset.kind !== "offline") return;
  $("#net-title").textContent = "Back online";
  $("#net-msg").textContent = "Your connection is back. Tap Try again.";
});
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
$("#arr-done").addEventListener("click", finishArrival);
$("#arr-share").addEventListener("click", () => void shareTrip());
$("#place-close").addEventListener("click", hidePlace);
$("#place-go").addEventListener("click", () => { hidePlace(); void plan(); });
$("#place-save").addEventListener("click", saveOpenPlace);
mountVoiceMute($("#drive-mute") as HTMLButtonElement);
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
$("#review-go").addEventListener("click", () => startDrive());
{
  const slot = document.querySelector<HTMLElement>("#lane-strip");
  if (slot) mountLaneStrip(slot);
}
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
const profileSheet = mountProfile({
  places: () => ({ home: garage.home, work: garage.work }),
  clearPlace: (which) => { garage[which] = null; persist(); },
  openGarage: () => garageEl.classList.add("open"),
  onChange: () => command.refreshHistory(),
  onHistoryCleared: () => command.refreshHistory(),
  sharing: () => garage.shareWithFriends,
  setSharing: (on) => { garage.shareWithFriends = on; persist(); friends.refresh(); },
});
// Real GPS only.
const radar = mountRadar({
  getFix: () => liveFix,
  getCenter: () => ({ lat: map.getCenter().lat, lon: map.getCenter().lng }),
  openProfile: () => profileSheet.open(),
});
$("#drive-report").addEventListener("click", () => radar.openReport());
const friends = mountFriends({
  map,
  getFix: () => liveFix,
  sharing: () => garage.shareWithFriends,
  setSharing: (on) => { garage.shareWithFriends = on; persist(); },
});
$("#ov-profile").addEventListener("click", () => { overflowEl.classList.remove("open"); profileSheet.open(); });
map.on("moveend", () => {
  if ((hudMode === "review" || hudMode === "plan") && routes.length && Math.abs(map.getZoom() - chipLayoutZoom) > 0.25) paintRouteChips();
});
const command = mountCommand({
  map,
  driverName: () => loadProfile()?.name ?? "",
  onSearch: () => { $("#search-card").classList.add("open"); toInput.focus(); },
  onGarage: () => garageEl.classList.add("open"),
  onProfile: () => profileSheet.open(),
  onLocate: () => { if (!tracker) locateMe(); else if (liveFix) map.easeTo({ center: [liveFix.pos.lon, liveFix.pos.lat], zoom: 15, duration: 700 }); },
  onSelectRoute: (id) => selectRoute(id),
  avoidTolls: () => garage.avoid.tolls,
  look: () => garage.look,
  setLook: (look) => setLook(look),
});
$("#ov-insights").addEventListener("click", () => { overflowEl.classList.remove("open"); command.openSheet(true); });
const traffic = mountTraffic({
  map,
  look: () => garage.look,
  enabled: () => garage.showTraffic,
  getCenter: () => ({ lat: map.getCenter().lat, lon: map.getCenter().lng }),
  getBounds: () => {
    if (!styleReady) return null;
    const b = map.getBounds();
    return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
  },
  getRoute: () => {
    const r = routes.find((x) => x.id === selectedId);
    if (!r || !selectedCoords.length) return null;
    return { id: r.id, coords: selectedCoords, durationSec: r.durationSec, distanceMi: r.distanceMi };
  },
  alongMi: () => progressMi,
  onSummary: applyTrafficHud,
});
function applyTrafficHud(s: TrafficSummary) {
  lastTraffic = s;
  const note = $("#review-eta-note");
  if (note) note.textContent = s.etaNote;
  const chip = $("#drive-traffic");
  if (chip) {
    chip.hidden = !s.line || hudMode !== "drive";
    chip.textContent = s.line ?? "";
  }
  const sel = routes.find((r) => r.id === selectedId);
  command.setTraffic({
    line: s.line,
    live: s.live || traffic.items().length > 0,
    incidents: traffic.items().slice(0, 4).map(incidentAlert),
  });
  if (sel && hudMode === "review") {
    $("#review-eta").textContent = formatDuration(sel.durationSec + (s.live ? s.delaySec : 0));
  }
  if (hudMode === "drive" && sel) updateDriveMeta(sel, progressMi);
}
function incidentAlert(it: RadarItem): Alert {
  const level = it.kind === "crash" || it.kind === "closure" ? "red" : it.kind === "jam" || it.kind === "roadwork" || it.kind === "hazard" ? "orange" : "info";
  return { level, title: it.title, detail: `${it.detail} · ${ago(it.createdAt)}` };
}
$("#chip-home").addEventListener("click", () => useOrSavePlace("home"));
$("#chip-work").addEventListener("click", () => useOrSavePlace("work"));
$("#chip-saved").addEventListener("click", () => {
  const saved = savedChipPlace();
  if (!saved) return;
  openPlace({ label: saved.label, lon: saved.lon, lat: saved.lat, kind: "saved" });
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
void driverReady.then((driver) => {
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
  void finishLinkSignIn();
});

/** Back from the emailed sign-in link: finish signing in, then show the account in Profile. */
async function finishLinkSignIn() {
  if (!cloudConfigured()) return;
  const result = await finishEmailLink();
  if (!result) return;
  if (!result.ok) setSocialNotice(result.message);
  showCoach(false);
  profileSheet.open();
  document.querySelector("#pf-social")?.scrollIntoView({ block: "start" });
}

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
  document.documentElement.dataset.look = cfg.look;
  document.documentElement.style.setProperty("--glow", cfg.glow);
  document.documentElement.style.setProperty("--mint", TRAILS[cfg.trail].line);
}
/** Night / Ember / Sand: panels follow via [data-look] CSS, the map is repainted here. */
function setLook(look: Look) {
  if (garage.look === look) return;
  garage.look = look;
  persist();
  whenStyleReady(() => liftNightBasemap(map, look));
  const sel = document.querySelector<HTMLSelectElement>("#g-look");
  if (sel) sel.value = look;
  command.syncLook();
  traffic?.restyle();
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
      openPlace({
        label: btn.textContent || "",
        lon: Number(btn.dataset.lon),
        lat: Number(btn.dataset.lat),
        kind: "recent",
      });
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
  $("#loc-title").textContent = LOCATION_TITLES[problem];
  $("#loc-msg").textContent = LOCATION_MESSAGES[problem];
  // Mid-drive there's no start point to search; the drive just waits for GPS.
  $("#loc-search").toggleAttribute("hidden", hudMode === "drive");
  const sheet = $("#loc-banner");
  sheet.dataset.kind = problem;
  sheet.removeAttribute("hidden");
}

function openPlace(hit: SearchHit) {
  dest = { lon: hit.lon, lat: hit.lat };
  destLabel = hit.label;
  toInput.value = hit.label;
  showError("");
  const parts = hit.name ? { name: hit.name, address: hit.label } : splitPlaceLabel(hit.label);
  $("#place-name").textContent = parts.name;
  $("#place-addr").textContent = parts.address;
  $("#place-saved").hidden = true;
  $("#place-card").removeAttribute("hidden");
  $("#search-card").classList.remove("open");
}

function hidePlace() {
  $("#place-card").setAttribute("hidden", "");
}

function saveOpenPlace() {
  if (!dest) return;
  rememberRecent({ label: destLabel, lon: dest.lon, lat: dest.lat });
  $("#place-saved").hidden = false;
}

async function shareTrip() {
  const time = $("#arr-time").textContent || "";
  const dist = $("#arr-dist").textContent || "";
  const line = $("#arr-line").textContent || "";
  const bits = ["Slide", time, dist];
  if (line && line !== EMPTY.line) bits.push(line);
  const text = bits.filter((s) => s && s !== EMPTY.driveTime && s !== EMPTY.driven).join(" · ");
  const payload = { title: "Slide trip", text };
  window.dispatchEvent(new CustomEvent("slide:share-trip", { detail: payload }));
  if (navigator.share) {
    try { await navigator.share(payload); } catch { /* dismissed */ }
  }
}
function hideLocationProblem() {
  $("#loc-banner").setAttribute("hidden", "");
}
/** Offline / server down / no road between the points: say which, with one Try again. */
let netRetry: (() => void) | null = null;
let netWhat: FailWhat | null = null;
function showFailure(err: unknown, what: FailWhat, retry: () => void) {
  const f = classifyFailure(err, navigator.onLine, what);
  $("#net-title").textContent = f.title;
  $("#net-msg").textContent = f.body;
  const sheet = $("#net-sheet");
  sheet.dataset.kind = f.kind;
  netRetry = retry;
  netWhat = what;
  sheet.removeAttribute("hidden");
}
function hideFailure() {
  $("#net-sheet").setAttribute("hidden", "");
  netRetry = null;
  netWhat = null;
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
    openPlace({ label: saved.label, lon: saved.lon, lat: saved.lat, kind: slot });
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
  const look = $("#g-look") as HTMLSelectElement;
  look.value = garage.look;
  look.addEventListener("change", () => setLook(look.value as Look));
  const cam = $("#g-cam") as HTMLSelectElement;
  const build = $("#g-build") as HTMLInputElement;
  const trafficBox = $("#g-traffic") as HTMLInputElement;
  const ghostsBox = $("#g-ghosts") as HTMLInputElement;
  const share = $("#g-share") as HTMLInputElement;
  tag.value = garage.tag; trail.value = garage.trail; cam.value = garage.camera;
  build.checked = garage.showBuildings; trafficBox.checked = garage.showTraffic; ghostsBox.checked = garage.showGhosts; share.checked = garage.shareGhost;
  paintSwatches($("#g-body"), PAINTS, garage.carColor, (c) => { garage.carColor = c; persist(); restylePlayer(); });
  paintSwatches($("#g-glow"), ["#f0a04b","#78e0c8","#b388ff","#8fd3ff","#d6ff3c","#ff4d6d"], garage.glow, (c) => { garage.glow = c; persist(); restylePlayer(); });
  paintShowroom();
  tag.addEventListener("change", () => { garage.tag = tag.value.toUpperCase() || "SLIDE-01"; persist(); });
  trail.addEventListener("change", () => { garage.trail = trail.value as GarageConfig["trail"]; persist(); paintRoutes(); });
  cam.addEventListener("change", () => { garage.camera = cam.value as GarageConfig["camera"]; persist(); applyCamera(garage.camera); });
  build.addEventListener("change", () => { garage.showBuildings = build.checked; persist(); toggleBuildings(build.checked); });
  trafficBox.addEventListener("change", () => { garage.showTraffic = trafficBox.checked; persist(); traffic.setEnabled(trafficBox.checked); });
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
  radar.setMode(mode);
  friends.setMode(mode);
  const reviewing = mode === "review";
  driveBarEl.toggleAttribute("hidden", !driving);
  reviewEl.toggleAttribute("hidden", !reviewing);
  $("#arrival").toggleAttribute("hidden", mode !== "arrive");
  $("#drive-mute").toggleAttribute("hidden", !driving);
  $("#drive-report").toggleAttribute("hidden", !driving);
  if (mode !== "plan") hidePlace();
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
/** Go = real GPS, always. There is no simulated car. */
function startDrive() {
  if (!routes.length) return;
  driveLog = { ...freshLog(), startedAt: Date.now() };
  offSince = 0;
  disp = null;
  followCamera = true;
  hideLocationProblem();
  renderSpeedRail();
  bootDrive();
  startVoice();
  setHudMode("drive");
  startLocation({ center: false });
  if (!liveFix) setStatus("Waiting for GPS…");
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
  stopVoice();
  saveDriveToHistory();
  stopDriveLoop();
  followCamera = true;
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
  stopVoice();
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
  const destName = destLabel ? splitPlaceLabel(destLabel).name : EMPTY.dest;
  $("#arr-dest").textContent = destName;
  $("#arr-time").textContent = startedAt ? formatDuration((now.getTime() - startedAt) / 1000) : EMPTY.driveTime;
  $("#arr-dist").textContent = formatMiles(drivenMi);
  $("#arr-line").textContent = route?.tags[0] ?? route?.label ?? EMPTY.line;
  $("#arr-note").textContent = drivenMi >= 0.2 ? "Saved to Your trips on this phone." : "Short drive — not saved to Your trips.";
  $("#arr-ride").innerHTML = carSvg(garage.carColor, garage.glow);
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
  // False starts (under 0.2 mi, or never on live GPS) are never recorded.
  const log = driveLog;
  driveLog = freshLog();
  if (!route || !log.live || log.drivenMi < 0.2 || !log.startedAt) return;
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
    tollRoad: route.hasToll,
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
        if (netWhat === "search") hideFailure();
      } catch (err) {
        close();
        if (input.value.trim().length >= 2) showFailure(err, "search", () => input.dispatchEvent(new Event("input")));
      }
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
      if (hudMode === "drive") {
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
      } else if (hudMode === "drive") {
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
  // One request at a time, and stop once there are enough distinct lines: the
  // public Valhalla server rate-limits, and a burst of parallel calls is the
  // fastest way to get every one of them refused.
  const points = [from, ...stops.map((s) => ({ lon: s.lon, lat: s.lat })), to];
  const results: Array<PromiseSettledResult<RouteResponse>> = [];
  for (const v of variantsFor(garage.avoid.tolls)) {
    try {
      results.push({ status: "fulfilled", value: await requestRouteVariant(points, v, garage.avoid) });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
    if (mergeVariantTrips(results).length >= 3) break;
  }
  const trips = mergeVariantTrips(results);
  if (!trips.length) {
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw failed ? failed.reason : new Error("No routes returned.");
  }
  const scored = [];
  for (const trip of trips) {
    const attrs = await requestTraceAttributes(tripShape(trip));
    scored.push(scoreTrip(trip, attrs.edges ?? [], "miles"));
  }
  return rankRoutes(scored);
}
async function plan() {
  if (planning) return;
  showError("");
  hidePlace();
  hideLocationProblem();
  hideFailure();
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
    if (!routes.length) throw new Error("No routes returned.");
    selectedId = routes[0]?.id ?? "";
    loadSelectedRoute();
    paintRoutes();
    renderDash();
    renderReview();
    setHudMode("review");
    setStatus("");
  } catch (err) {
    $("#search-card").classList.add("open");
    showFailure(err, "route", () => void plan());
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
    if (hudMode !== "drive" || !next.length) return;
    routes = next;
    selectedId = routes[0].id;
    origin = from;
    originLabel = "Current location";
    loadDriveRoute();
    resetVoice();
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
  traffic.refresh();
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
    const chipSec = r.durationSec + (r.id === selectedId && lastTraffic.live ? lastTraffic.delaySec : 0);
    el.innerHTML = `<b>${formatDuration(chipSec)}</b>${tag ? `<span>${tag}</span>` : ""}${showToll ? `<em class="${r.hasToll ? "toll" : "free"}">${toll}</em>` : ""}`;
    el.setAttribute("aria-label", [...new Set([formatDuration(chipSec), ...r.tags, toll].filter(Boolean))].join(", "));
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
  const cards = routeCards(routes, selectedId);
  const track = $("#route-track");
  const ids = cards.map((c) => c.id).join();
  if (track.dataset.ids !== ids) {
    track.dataset.ids = ids;
    track.innerHTML = cards.map((c) => `<button type="button" class="route-card${c.selected ? " on" : ""}" data-id="${c.id}" aria-pressed="${c.selected}" aria-label="${esc(cardAriaLabel(c))}">
      <span class="route-card-tag">${esc(c.tag)}</span>
      <b>${esc(c.time)}</b>
      <span class="route-card-mi">${esc(c.miles)}</span>
      <span class="route-card-why">${esc(c.why)}</span>
      ${c.toll ? `<em class="${c.toll === "Has tolls" ? "toll" : "free"}">${esc(c.toll)}</em>` : ""}
    </button>`).join("");
    const dots = $("#route-dots");
    dots.hidden = cards.length < 2;
    dots.innerHTML = cards.map((c) => `<i class="${c.selected ? "on" : ""}" data-id="${c.id}"></i>`).join("");
    bindCarousel(track);
  } else {
    track.querySelectorAll<HTMLElement>(".route-card").forEach((el) => {
      const on = el.dataset.id === selectedId;
      el.classList.toggle("on", on);
      el.setAttribute("aria-pressed", String(on));
    });
    $("#route-dots").querySelectorAll<HTMLElement>("i").forEach((el) => el.classList.toggle("on", el.dataset.id === selectedId));
  }
  const active = track.querySelector<HTMLElement>(`.route-card[data-id="${selectedId}"]`);
  if (active && !track.dataset.swiping) {
    active.scrollIntoView({ inline: "center", block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  const liveSec = sel.durationSec + (lastTraffic.live ? lastTraffic.delaySec : 0);
  $("#review-eta").textContent = formatDuration(liveSec);
  $("#review-dist").textContent = formatMiles(sel.distanceMi);
  $("#review-via").textContent = viaLine(sel.maneuvers);
  const shortWhy = sel.why.split(" · ")[0] || sel.label;
  const toll = tollLabel(sel.hasToll);
  const head = routes.length === 1 || sel.tags.length === 2
    ? "Slide pick · Fastest is also the smoothest line we found"
    : [sel.tags.join(" · ") || sel.label, shortWhy].filter(Boolean).join(" · ");
  $("#review-tag").textContent = toll && !sel.tags.includes("No tolls") ? `${head} · ${toll}` : head;
  $("#review-eta-note").textContent = lastTraffic.etaNote;
  renderStops();
}

function bindCarousel(track: HTMLElement) {
  track.querySelectorAll<HTMLButtonElement>(".route-card").forEach((btn) => {
    btn.onclick = () => { if (btn.dataset.id) selectRoute(btn.dataset.id); };
  });
  let timer = 0;
  track.onscroll = () => {
    track.dataset.swiping = "1";
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const mid = track.getBoundingClientRect().left + track.clientWidth / 2;
      let bestId = "";
      let bestD = Infinity;
      for (const el of track.querySelectorAll<HTMLElement>(".route-card")) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestD) { bestD = d; bestId = el.dataset.id || ""; }
      }
      delete track.dataset.swiping;
      if (bestId && bestId !== selectedId) selectRoute(bestId);
    }, 80);
  };
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
  if (sel) {
    const liveSec = sel.durationSec + (lastTraffic.live ? lastTraffic.delaySec : 0);
    $("#stat-score").textContent = String(sel.slideScore);
    $("#stat-eta").textContent = arrivalClock(liveSec);
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
  speedsEl.innerHTML = `<h2>${originLabel || "Start"} → ${destLabel || "End"} · posted ${Math.round(route.postedCoverage * 100)}%</h2><div class="bands">${route.bands.map((b) => `<div class="band"><div class="name">${esc(b.name)}</div><div class="spd">${b.postedMph ?? EMPTY.posted} <small>posted</small></div><div class="sub">expect ${b.expectedMph || EMPTY.expected} · ${formatMiles(b.toMi - b.fromMi)}</div></div>`).join("")}</div>`;
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
  spawnPlayer(); spawnGhosts();
  $("#speedo").removeAttribute("hidden");
  if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(tick); }
}
function carSvg(color: string, glow: string, ghost = false): string {
  return ghost
    ? vehicleSvg({ model: "classic", paint: color, accent: glow, livery: "solid", ghost: true })
    : vehicleSvg({ model: garage.vehicle, paint: color, accent: glow, livery: garage.livery });
}
function spawnPlayer() {
  playerMarker?.remove();
  const el = document.createElement("div");
  el.className = "car-marker";
  el.innerHTML = carSvg(garage.carColor, garage.glow);
  playerMarker = new maplibregl.Marker({ element: el, anchor: "center", pitchAlignment: "map", rotationAlignment: "map" }).setLngLat(selectedCoords[0]).addTo(map);
}
function restylePlayer() {
  paintShowroom();
  you.setCar(carSvg(garage.carColor, garage.glow));
  if (!playerMarker) return;
  playerMarker.getElement().innerHTML = carSvg(garage.carColor, garage.glow);
}
/** Garage showroom: big preview, a card per ride, livery pills. */
function paintShowroom() {
  const stage = document.querySelector<HTMLElement>("#g-preview");
  if (!stage) return;
  const v = vehicleById(garage.vehicle);
  stage.innerHTML = carSvg(garage.carColor, garage.glow);
  $("#g-ride-name").textContent = v.name;
  $("#g-ride-kind").textContent = v.kind;
  $("#g-ride-pack").textContent = v.pack;
  const rides = $("#g-rides");
  rides.innerHTML = VEHICLES.map((r) => `<button type="button" role="radio" class="ride${r.id === garage.vehicle ? " on" : ""}" aria-checked="${r.id === garage.vehicle}" data-ride="${r.id}" aria-label="${r.name}, ${r.kind}">${vehicleSvg({ model: r.id, paint: garage.carColor, accent: garage.glow, livery: garage.livery })}<span>${r.name}</span></button>`).join("");
  rides.querySelectorAll<HTMLButtonElement>("[data-ride]").forEach((b) => b.addEventListener("click", () => {
    garage.vehicle = b.dataset.ride as VehicleId; persist(); restylePlayer();
  }));
  const liv = $("#g-livery");
  liv.innerHTML = LIVERIES.map((l) => `<button type="button" role="radio" class="${l === garage.livery ? "on" : ""}" aria-checked="${l === garage.livery}" data-livery="${l}">${LIVERY_LABEL[l]}</button>`).join("");
  liv.querySelectorAll<HTMLButtonElement>("[data-livery]").forEach((b) => b.addEventListener("click", () => {
    garage.livery = b.dataset.livery as Livery; persist(); restylePlayer();
  }));
}
function spawnGhosts() {
  ghostMarkers.forEach((m) => m.remove()); ghostMarkers = [];
  // Real ghosts only (your recorded pace run, opt-in friends) — none are wired yet, so none are drawn.
  ghosts = [];
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

  if (liveFix) {
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
    if (!disp) {
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
  $("#speed-n").textContent = mph === null ? "0" : String(mph);
  $("#speed-src").textContent = "MPH";

  renderGuidance(progressMi, mph ?? 0);
  updateDriveMeta(route, progressMi);

  ghosts.forEach((g, i) => { const s = stepGhost(g, dt); ghostMarkers[i]?.setLngLat([s.lon, s.lat]); ghostMarkers[i]?.setRotation(s.bearing); });
  if (ghosts.length) {
    // Both clocks wrap at the end of the lap, so take the shortest signed gap
    // instead of letting the delta jump by a whole trip duration.
    const selfT = totalMi > 0 ? Math.min(1, progressMi / totalMi) : 0;
    const wrapped = ((ghosts[0].t - selfT + 0.5) % 1 + 1) % 1 - 0.5;
    const lead = (wrapped * (route?.durationSec ?? 0)).toFixed(1);
    $("#ghost-delta").textContent = `GHOST ${Number(lead) >= 0 ? "+" : ""}${lead}s`;
    $("#ghost-delta").removeAttribute("hidden");
  } else {
    $("#ghost-delta").setAttribute("hidden", "");
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
  const liveRemain = remainSec + (lastTraffic.live ? lastTraffic.delaySec * (remainMi / Math.max(route.distanceMi, 0.01)) : 0);
  $("#drive-eta").textContent = formatDuration(liveRemain);
  $("#drive-remain").textContent = `${formatMiles(remainMi)} · ${arrivalClock(liveRemain)}`;
  const chip = $("#drive-traffic");
  if (chip) {
    chip.hidden = !lastTraffic.line;
    chip.textContent = lastTraffic.line ?? "";
  }
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
    renderLaneStrip(null);
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
    renderLaneStrip(hudMode === "drive" ? move.lanes : null, move.distanceMi);
    if (hudMode === "drive") tickVoice(steps, mi);
  } else {
    maneuverEl.setAttribute("hidden", "");
    renderLaneStrip(null);
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
// The service worker is registered by boot.ts.
