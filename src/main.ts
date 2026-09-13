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

const MIAMI: LonLat = { lon: -80.1918, lat: 25.7617 };
const STYLE = "https://tiles.openfreemap.org/styles/dark";

const app = document.querySelector("#app")!;
app.innerHTML = `
  <div id="map"></div>
  <div class="hud">
    <div class="search-card">
      <div class="brand">
        <h1>Slide</h1>
        <span>smooth · exact · timed</span>
      </div>
      <div class="fields">
        <div class="field" id="from-field">
          <label>From</label>
          <input id="from" placeholder="Current location or address" autocomplete="off" />
          <div class="suggest" id="from-suggest" hidden></div>
        </div>
        <div class="field" id="to-field">
          <label>To</label>
          <input id="to" placeholder="Where are you going?" autocomplete="off" />
          <div class="suggest" id="to-suggest" hidden></div>
        </div>
      </div>
      <div class="actions">
        <button class="primary" id="go">Get Slide route</button>
        <button class="ghost" id="locate">Use my location</button>
      </div>
      <div class="error" id="error" hidden></div>
    </div>
    <div class="status-pill" id="status">Planning the smoothest line…</div>
    <div class="route-card" id="routes" hidden></div>
    <div class="speed-rail" id="speeds" hidden></div>
  </div>
`;

const map = new maplibregl.Map({
  container: "map",
  style: STYLE,
  center: [MIAMI.lon, MIAMI.lat],
  zoom: 11.4,
  attributionControl: false,
});

map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

let origin: LonLat | null = null;
let dest: LonLat | null = null;
let originLabel = "";
let destLabel = "";
let routes: SlideRoute[] = [];
let selectedId = "";
const markers: maplibregl.Marker[] = [];

const fromInput = document.querySelector<HTMLInputElement>("#from")!;
const toInput = document.querySelector<HTMLInputElement>("#to")!;
const errorEl = document.querySelector("#error")!;
const statusEl = document.querySelector("#status")!;
const routesEl = document.querySelector("#routes")!;
const speedsEl = document.querySelector("#speeds")!;

bindSearch(fromInput, document.querySelector("#from-suggest")!, (hit) => {
  origin = { lon: hit.lon, lat: hit.lat };
  originLabel = hit.label;
  fromInput.value = hit.label;
  dropMarker(origin, "#78e0c8");
});

bindSearch(toInput, document.querySelector("#to-suggest")!, (hit) => {
  dest = { lon: hit.lon, lat: hit.lat };
  destLabel = hit.label;
  toInput.value = hit.label;
  dropMarker(dest, "#f3c15a");
});

document.querySelector("#locate")!.addEventListener("click", locateMe);
document.querySelector("#go")!.addEventListener("click", plan);

toInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") plan();
});

function bindSearch(
  input: HTMLInputElement,
  box: HTMLElement,
  onPick: (hit: SearchHit) => void
) {
  let timer = 0;
  let items: SearchHit[] = [];
  let active = -1;

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        items = await searchPlaces(input.value, origin ?? MIAMI);
        renderSuggest(box, items, active, onPick, () => {
          box.hidden = true;
        });
        box.hidden = items.length === 0;
      } catch {
        box.hidden = true;
      }
    }, 220);
  });

  input.addEventListener("keydown", (e) => {
    if (box.hidden || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % items.length;
      renderSuggest(box, items, active, onPick, () => {
        box.hidden = true;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = (active - 1 + items.length) % items.length;
      renderSuggest(box, items, active, onPick, () => {
        box.hidden = true;
      });
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      onPick(items[active]);
      box.hidden = true;
    } else if (e.key === "Escape") {
      box.hidden = true;
    }
  });

  document.addEventListener("click", (e) => {
    if (!box.contains(e.target as Node) && e.target !== input) box.hidden = true;
  });
}

function renderSuggest(
  box: HTMLElement,
  items: SearchHit[],
  active: number,
  onPick: (hit: SearchHit) => void,
  hide: () => void
) {
  box.innerHTML = "";
  items.forEach((hit, i) => {
    const btn = document.createElement("button");
    btn.textContent = hit.label;
    if (i === active) btn.classList.add("active");
    btn.addEventListener("click", () => {
      onPick(hit);
      hide();
    });
    box.appendChild(btn);
  });
}

function dropMarker(point: LonLat, color: string) {
  const el = document.createElement("div");
  el.style.width = "14px";
  el.style.height = "14px";
  el.style.borderRadius = "50%";
  el.style.background = color;
  el.style.boxShadow = `0 0 0 6px ${color}33`;
  const marker = new maplibregl.Marker({ element: el }).setLngLat([point.lon, point.lat]).addTo(map);
  markers.push(marker);
}

async function locateMe() {
  if (!navigator.geolocation) {
    showError("Geolocation is not available in this browser.");
    return;
  }
  setStatus("Finding your position…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      origin = { lon: pos.coords.longitude, lat: pos.coords.latitude };
      originLabel = "Current location";
      fromInput.value = "Current location";
      map.easeTo({ center: [origin.lon, origin.lat], zoom: 13 });
      dropMarker(origin, "#78e0c8");
      setStatus("");
    },
    () => {
      showError("Could not read location. Allow location access or type an address.");
      setStatus("");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function plan() {
  showError("");
  if (!origin) {
    showError("Set a start point.");
    return;
  }
  if (!dest) {
    showError("Set a destination.");
    return;
  }

  setStatus("Scoring routes for smoothness, posted speeds, and timing…");
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
    drawRoutes();
    renderRouteCard();
    renderSpeedRail();
    setStatus("");
  } catch (err) {
    showError(err instanceof Error ? err.message : "Routing failed.");
    setStatus("");
  }
}

function drawRoutes() {
  const features = routes.map((r) => ({
    type: "Feature" as const,
    properties: { id: r.id, selected: r.id === selectedId },
    geometry: {
      type: "LineString" as const,
      coordinates: decodePolyline6(r.trip.legs.map((l) => l.shape).join("")),
    },
  }));

  const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };

  if (map.getSource("routes")) {
    (map.getSource("routes") as maplibregl.GeoJSONSource).setData(data);
  } else {
    map.addSource("routes", { type: "geojson", data });
    map.addLayer({
      id: "routes-back",
      type: "line",
      source: "routes",
      paint: {
        "line-color": "#0b1a22",
        "line-width": 10,
        "line-opacity": 0.7,
      },
    });
    map.addLayer({
      id: "routes-line",
      type: "line",
      source: "routes",
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "selected"], true],
          "#78e0c8",
          "#4a6570",
        ],
        "line-width": ["case", ["==", ["get", "selected"], true], 6, 4],
        "line-opacity": ["case", ["==", ["get", "selected"], true], 0.95, 0.45],
      },
    });
  }

  const selected = routes.find((r) => r.id === selectedId);
  if (selected) {
    const coords = decodePolyline6(selected.trip.legs.map((l) => l.shape).join(""));
    if (coords.length) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: { top: 80, left: 40, right: 360, bottom: 220 }, duration: 700 });
    }
  }
}

function renderRouteCard() {
  if (!routes.length) {
    routesEl.setAttribute("hidden", "");
    return;
  }
  routesEl.removeAttribute("hidden");
  routesEl.innerHTML = routes
    .map((r) => {
      const selected = r.id === selectedId ? " selected" : "";
      return `
        <button class="route-option${selected}" data-id="${r.id}">
          <div class="row">
            <span class="tag">${r.label} · ${r.slideScore}</span>
            <span class="eta">${formatDuration(r.durationSec)}</span>
          </div>
          <div class="meta">${formatMiles(r.distanceMi)} · arrive ${arrivalClock(r.durationSec)} · ${r.turns} turns</div>
          <div class="why">${r.why}</div>
        </button>
      `;
    })
    .join("");

  routesEl.querySelectorAll<HTMLButtonElement>(".route-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedId = btn.dataset.id || selectedId;
      drawRoutes();
      renderRouteCard();
      renderSpeedRail();
    });
  });
}

function renderSpeedRail() {
  const route = routes.find((r) => r.id === selectedId);
  if (!route) {
    speedsEl.setAttribute("hidden", "");
    return;
  }
  speedsEl.removeAttribute("hidden");
  const avg = route.durationSec > 0 ? route.distanceMi / (route.durationSec / 3600) : 0;
  speedsEl.innerHTML = `
    <h2>${originLabel || "Start"} → ${destLabel || "End"} · avg ${avg.toFixed(0)} mph · posted coverage ${Math.round(route.postedCoverage * 100)}%</h2>
    <div class="bands">
      ${route.bands
        .map(
          (b) => `
        <div class="band">
          <div class="name">${escapeHtml(b.name)}</div>
          <div class="spd">${b.postedMph ?? "—"} <small>posted</small></div>
          <div class="sub">expect ${b.expectedMph || "—"} mph · ${formatMiles(b.toMi - b.fromMi)} · ${formatDuration(b.seconds)}</div>
        </div>`
        )
        .join("")}
    </div>
  `;
}

function setStatus(text: string) {
  statusEl.textContent = text;
  statusEl.classList.toggle("show", Boolean(text));
}

function showError(text: string) {
  errorEl.textContent = text;
  errorEl.toggleAttribute("hidden", !text);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
