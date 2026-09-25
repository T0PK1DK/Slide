import type maplibregl from "maplibre-gl";
import { loadTrips, minutesByDay, overview, weekTiles, type Tile, type TripRecord, type Window } from "../lib/history";
import { buildAlerts, suggestSwitch, type Alert } from "../lib/alerts";
import { currentWeather } from "../lib/sources/weather";
import { formatDuration, type SlideRoute } from "../lib/smooth";

/**
 * Command view — Slide's take on the owner's "SEKAI" network dashboard
 * (docs/DESIGN.md). Wide screens get the full three-column layout around the
 * map; phones get the same panels as an Insights sheet. Every figure is drawn
 * from on-device drive history or the route currently planned — nothing is
 * predicted, invented, or shown as traffic.
 */
export type CommandHooks = {
  map: maplibregl.Map;
  driverName: () => string;
  onSearch: () => void;
  onGarage: () => void;
  onProfile: () => void;
  onLocate: () => void;
  onSelectRoute: (id: string) => void;
  /** Driver's Avoid-tolls option, so the alert list can say when it couldn't be honoured. */
  avoidTolls: () => boolean;
};

export type CommandView = {
  setRoutes(routes: SlideRoute[], selectedId: string): void;
  refreshHistory(): void;
  openSheet(on: boolean): void;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ICON = {
  logo: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 16c3-7 13-7 16 0"/><path d="M4 11c3-5 13-5 16 0" opacity=".55"/><path d="M4 6c3-3 13-3 16 0" opacity=".3"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
  chev: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`,
  locate: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21 3L3 10.5l7.5 2.9L13.4 21z"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>`,
  route: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>`,
  alt: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 20V9a5 5 0 0 1 5-5h7"/><path d="M15 1l3 3-3 3"/><path d="M6 13h8"/></svg>`,
  bars: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="4" y="12" width="3" height="8" rx="1"/><rect x="10.5" y="8" width="3" height="12" rx="1"/><rect x="17" y="4" width="3" height="16" rx="1"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
};

/** Area-under-line chart for the smooth trend, 0–100 scale, with gridlines like the reference. */
function trendSvg(values: number[]): string {
  const w = 280, h = 96;
  if (values.length < 2) {
    return `<div class="cmd-empty">Drive twice to see your trend.</div>`;
  }
  const step = w / (values.length - 1);
  const y = (v: number) => h - (Math.max(0, Math.min(100, v)) / 100) * h;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
  const peak = values.indexOf(Math.max(...values));
  const grid = [25, 50, 75, 100]
    .map((g) => `<line x1="0" x2="${w}" y1="${y(g)}" y2="${y(g)}" class="cmd-grid"/><text x="${w + 6}" y="${y(g) + 3}" class="cmd-axis">${g}%</text>`)
    .join("");
  return `<svg viewBox="0 -8 ${w + 34} ${h + 12}" class="cmd-trend" role="img" aria-label="Smooth score per drive, oldest to newest">
    <defs><linearGradient id="cmd-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--glow)" stop-opacity=".28"/><stop offset="1" stop-color="var(--glow)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="0,${h} ${pts.join(" ")} ${w},${h}" fill="url(#cmd-fill)"/>
    <polyline points="${pts.join(" ")}" class="cmd-line"/>
    <circle cx="${(peak * step).toFixed(1)}" cy="${y(values[peak]).toFixed(1)}" r="3.5" class="cmd-peak"/>
  </svg>`;
}

/** Tiny line for a row or card (posted-speed profile). */
function sparkSvg(values: number[], cls = "cmd-spark"): string {
  if (values.length < 2) return "";
  const w = 84, h = 22;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - lo) / span) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" class="${cls}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

function hourBars(byHour: number[]): string {
  const max = Math.max(...byHour);
  if (max === 0) return `<div class="cmd-empty">Your drive rhythm appears after your first drive.</div>`;
  const nowH = new Date().getHours();
  const peak = byHour.indexOf(max);
  const bars = byHour
    .map((n, h) => `<span class="cmd-bar${h === peak ? " peak" : ""}${h === nowH ? " now" : ""}" style="height:${Math.max(4, (n / max) * 100)}%" title="${h}:00 · ${n} drive${n === 1 ? "" : "s"}"></span>`)
    .join("");
  const label = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `<div class="cmd-peak-tag"><b>${max}</b><span>${label(peak)}</span></div>
    <div class="cmd-bars" role="img" aria-label="Drives by hour of day, busiest ${label(peak)}">${bars}</div>
    <div class="cmd-hours"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>`;
}

function tripRow(t: TripRecord): string {
  const ok = t.offRouteEvents === 0;
  const when = new Date(t.startedAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return `<li class="cmd-trip">
    <div class="cmd-trip-l">
      <b>${esc(t.destLabel || "Drive")}</b>
      <span class="cmd-state ${ok ? "ok" : "warn"}">${ok ? "Clean run" : `${t.offRouteEvents} off-route`}</span>
    </div>
    <div class="cmd-trip-m">
      <span>${t.routeLabel} · ${t.distanceMi.toFixed(1)} mi</span>
      <span class="cmd-dim">${when}</span>
      ${sparkSvg(t.postedProfile)}
    </div>
    <div class="cmd-trip-r"><b>${t.slideScore}</b><span>%</span></div>
  </li>`;
}

/** Desktop stat tile: big number, small label, and a +/- trend vs last week. `lowerIsBetter` flips the colour. */
function tileHtml(label: string, t: Tile, fmt: (n: number) => string, unit: string, lowerIsBetter = false): string {
  const d = t.delta;
  const good = d !== null && (lowerIsBetter ? d < 0 : d > 0);
  const trend = d === null || Math.abs(d) < 0.05
    ? `<span class="cmd-tile-d flat">${d === null ? "no prior week" : "same as last week"}</span>`
    : `<span class="cmd-tile-d ${good ? "up" : "down"}">${d > 0 ? "+" : "−"}${fmt(Math.abs(d))} vs last week</span>`;
  return `<div class="cmd-tile"><span class="cmd-tile-l">${label}</span><b>${t.value === null ? "—" : fmt(t.value)}<small>${t.value === null ? "" : unit}</small></b>${trend}</div>`;
}

/** Seven-day sparkline (minutes driven per day), today last. */
function weekSpark(mins: number[]): string {
  if (mins.every((m) => m === 0)) return `<div class="cmd-empty">No drives in the last 7 days.</div>`;
  const w = 260, h = 56, max = Math.max(...mins, 1);
  const step = w / (mins.length - 1);
  const y = (m: number) => h - 4 - (m / max) * (h - 12);
  const pts = mins.map((m, i) => `${(i * step).toFixed(1)},${y(m).toFixed(1)}`).join(" ");
  const days = mins.map((_, i) => new Date(Date.now() - (6 - i) * 864e5).toLocaleDateString([], { weekday: "narrow" }));
  return `<svg viewBox="0 0 ${w} ${h}" class="cmd-week" role="img" aria-label="Minutes driven per day, last 7 days: ${mins.join(", ")}">
      <polyline points="0,${h} ${pts} ${w},${h}" class="cmd-week-fill"/>
      <polyline points="${pts}" class="cmd-week-line"/>
      <circle cx="${w}" cy="${y(mins[6]).toFixed(1)}" r="3" class="cmd-peak"/>
    </svg><div class="cmd-hours">${days.map((d) => `<span>${d}</span>`).join("")}</div>`;
}

function alertRow(a: Alert): string {
  return `<li class="cmd-alert ${a.level}"><i class="sev" aria-hidden="true"></i><div><b>${esc(a.title)}</b><span>${esc(a.detail)}</span></div><span class="sr">${a.level === "info" ? "Info" : a.level === "red" ? "Severe" : "Warning"}</span></li>`;
}

export function mountCommand(h: CommandHooks): CommandView {
  let win: Window = "7d";
  let wxLabel: string | null = null;
  let alerts: Alert[] = [];
  let routes: SlideRoute[] = [];
  let selectedId = "";

  const top = document.createElement("header");
  top.className = "cmd-top";
  top.innerHTML = `
    <div class="cmd-brand">${ICON.logo}<span>SLIDE</span></div>
    <nav class="cmd-tabs" aria-label="Sections">
      <button type="button" class="on" data-tab="live"><i></i>Live map</button>
      <button type="button" data-tab="drives">Drives</button>
      <button type="button" data-tab="routes">Routes</button>
      <button type="button" data-tab="insights">Insights</button>
      <button type="button" data-tab="garage">Garage</button>
    </nav>
    <button type="button" class="cmd-search">${ICON.search}<span>Search places, addresses, or routes…</span></button>
    <button type="button" class="cmd-bell" aria-label="Alerts" aria-expanded="false" aria-controls="cmd-alerts-drop">${ICON.bell}<i hidden></i></button>
    <div class="cmd-alerts-drop" id="cmd-alerts-drop" role="region" aria-label="Alerts" hidden></div>
    <button type="button" class="cmd-avatar" aria-label="Your profile"></button>`;

  const left = document.createElement("aside");
  left.className = "cmd-rail cmd-left";
  left.setAttribute("aria-label", "Your driving");
  const right = document.createElement("aside");
  right.className = "cmd-rail cmd-right";
  right.setAttribute("aria-label", "Route intelligence");

  const overlay = document.createElement("div");
  overlay.className = "cmd-overlay";
  overlay.innerHTML = `
    <div class="cmd-seg" role="tablist" aria-label="Map view">
      <button type="button" class="on" data-view="map" role="tab" aria-selected="true">Map</button>
      <button type="button" data-view="3d" role="tab" aria-selected="false">3D</button>
      <button type="button" data-view="sat" role="tab" aria-selected="false" aria-disabled="true" title="Satellite needs a licensed imagery source">Satellite</button>
    </div>
    <div class="cmd-clock">
      <span class="cmd-wx" hidden><span class="cmd-wx-ico"></span><span><b class="cmd-temp"></b><small class="cmd-cond"></small></span></span>
      <span><b class="cmd-time"></b><small class="cmd-date"></small></span>
    </div>
    <div class="cmd-route-card" hidden></div>
    <div class="cmd-stack">
      <button type="button" class="cmd-ctl" data-ctl="layers" aria-label="Map layers">${ICON.layers}</button>
      <div class="cmd-zoom">
        <button type="button" class="cmd-ctl" data-ctl="in" aria-label="Zoom in">${ICON.plus}</button>
        <button type="button" class="cmd-ctl" data-ctl="out" aria-label="Zoom out">${ICON.minus}</button>
      </div>
      <button type="button" class="cmd-ctl cmd-locate" data-ctl="locate" aria-label="Show my location">${ICON.locate}</button>
    </div>
    <p class="cmd-credit">Weather: Open-Meteo</p>`;

  const sheetClose = document.createElement("button");
  sheetClose.type = "button";
  sheetClose.className = "cmd-sheet-close";
  sheetClose.setAttribute("aria-label", "Close insights");
  sheetClose.innerHTML = ICON.close;

  const sheet = document.createElement("div");
  sheet.className = "cmd-sheet-wrap";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Drive insights");

  document.body.append(top, left, right, overlay, sheet, sheetClose);
  document.body.classList.add("cmd");

  // --- top bar
  top.querySelector(".cmd-search")!.addEventListener("click", h.onSearch);
  top.querySelectorAll<HTMLButtonElement>(".cmd-tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      const tab = b.dataset.tab;
      if (tab === "garage") return h.onGarage();
      top.querySelectorAll(".cmd-tabs button").forEach((x) => x.classList.toggle("on", x === b));
      if (tab === "drives") left.querySelector(".cmd-trips")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (tab === "routes") right.querySelector(".cmd-intel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (tab === "insights") right.querySelector(".cmd-rhythm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
  const avatar = top.querySelector<HTMLElement>(".cmd-avatar")!;
  avatar.addEventListener("click", h.onProfile);
  const paintAvatar = () => { avatar.textContent = (h.driverName().trim()[0] ?? "S").toUpperCase(); };

  // --- map overlay controls
  overlay.querySelectorAll<HTMLButtonElement>(".cmd-seg button").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.view === "sat") return;
      overlay.querySelectorAll<HTMLButtonElement>(".cmd-seg button").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-selected", String(x === b));
      });
      h.map.easeTo(b.dataset.view === "3d" ? { pitch: 60, duration: 700 } : { pitch: 0, bearing: 0, duration: 700 });
    })
  );
  overlay.querySelector('[data-ctl="in"]')!.addEventListener("click", () => h.map.zoomIn());
  overlay.querySelector('[data-ctl="out"]')!.addEventListener("click", () => h.map.zoomOut());
  overlay.querySelector('[data-ctl="locate"]')!.addEventListener("click", h.onLocate);
  overlay.querySelector('[data-ctl="layers"]')!.addEventListener("click", h.onGarage);

  // --- clock + weather
  const tick = () => {
    const now = new Date();
    overlay.querySelector(".cmd-time")!.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    overlay.querySelector(".cmd-date")!.textContent = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  };
  tick();
  window.setInterval(tick, 15_000);
  const loadWeather = async () => {
    const c = h.map.getCenter();
    const wx = await currentWeather(c.lat, c.lng);
    const box = overlay.querySelector<HTMLElement>(".cmd-wx")!;
    box.hidden = !wx;
    if (!wx) return;
    box.querySelector(".cmd-wx-ico")!.innerHTML = wx.isDay ? ICON.sun : ICON.moon;
    box.querySelector(".cmd-temp")!.textContent = `${wx.tempF}°F`;
    box.querySelector(".cmd-cond")!.textContent = wx.label;
    wxLabel = wx.label;
    renderAlerts();
  };
  void loadWeather();
  window.setInterval(() => void loadWeather(), 15 * 60 * 1000);

  // --- left rail: overview, smooth score, trips
  const renderLeft = () => {
    const trips = loadTrips();
    const o = overview(trips, win);
    const recent = trips.slice(0, 8);
    const wk = weekTiles(trips);
    const delta = o.smoothDelta;
    left.innerHTML = `
      <section class="cmd-card cmd-wide">
        <header><h2>This week</h2><span class="cmd-dim">vs the 7 days before</span></header>
        <div class="cmd-tiles">
          ${tileHtml("Avg trip", wk.avgTripMin, (n) => n.toFixed(0), " min", true)}
          ${tileHtml("Miles", wk.miles, (n) => n.toFixed(0), " mi")}
          ${tileHtml("Toll-road trips", wk.tollTrips, (n) => n.toFixed(0), "", true)}
          ${tileHtml("On time", wk.onTime, (n) => n.toFixed(0), "%")}
        </div>
      </section>
      <section class="cmd-card cmd-wide">
        <header><h2 class="cmd-sub">Minutes driven</h2><span class="cmd-dim">last 7 days</span></header>
        ${weekSpark(minutesByDay(trips))}
      </section>
      <section class="cmd-card cmd-narrow">
        <header><h2>Drive overview</h2>
          <label class="cmd-select"><span class="sr">Time window</span>
            <select>${(["24h", "7d", "30d"] as Window[]).map((w) => `<option${w === win ? " selected" : ""}>${w}</option>`).join("")}</select>
          </label>
        </header>
        <div class="cmd-kpis">
          <div><b>${o.drives}</b><span><i class="dot ok"></i>Drives</span></div>
          <div><b>${o.alerts}</b><span><i class="dot warn"></i>Off-route</span></div>
          <div><b>${o.miles.toFixed(0)}</b><span><i class="dot"></i>Miles</span></div>
        </div>
      </section>
      <section class="cmd-card">
        <header><h2 class="cmd-sub">Smooth score</h2>${delta !== null ? `<span class="cmd-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)}</span>` : ""}</header>
        <div class="cmd-big">${o.smoothAvg !== null ? `${o.smoothAvg.toFixed(1)}<small>%</small>` : `—`}</div>
        ${trendSvg(o.trend)}
      </section>
      <section class="cmd-trips">
        <header><h2>Your trips</h2><span class="cmd-dim">${trips.length} saved on this phone</span></header>
        ${recent.length ? `<ul>${recent.map(tripRow).join("")}</ul>` : `<div class="cmd-empty cmd-card">No drives yet. Plan a route and tap Go with location on — only real GPS drives are saved.</div>`}
      </section>`;
    left.querySelector("select")!.addEventListener("change", (e) => {
      win = (e.target as HTMLSelectElement).value as Window;
      renderLeft();
      renderRight();
    });
    renderAlerts();
  };

  // --- alerts: bell dropdown + right-rail list (desktop). Real sources only (src/lib/alerts.ts).
  const drop = top.querySelector<HTMLElement>("#cmd-alerts-drop")!;
  const bell = top.querySelector<HTMLButtonElement>(".cmd-bell")!;
  const renderAlerts = () => {
    alerts = buildAlerts({ route: routes.find((r) => r.id === selectedId), avoidTolls: h.avoidTolls(), trips: loadTrips(), weather: wxLabel });
    const live = alerts.filter((a) => a.level === "red" || a.level === "orange");
    bell.querySelector<HTMLElement>("i")!.hidden = live.length === 0;
    bell.setAttribute("aria-label", live.length ? `Alerts, ${live.length} active` : "Alerts");
    drop.innerHTML = `<h4>${live.length ? `${live.length} active alert${live.length === 1 ? "" : "s"}` : "No active alerts"}</h4><ul>${alerts.map(alertRow).join("")}</ul>`;
    const list = right.querySelector(".cmd-alert-list");
    if (list) list.innerHTML = alerts.map(alertRow).join("");
  };
  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = drop.hidden;
    drop.hidden = !open;
    bell.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!drop.hidden && !drop.contains(e.target as Node)) { drop.hidden = true; bell.setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drop.hidden) { drop.hidden = true; bell.setAttribute("aria-expanded", "false"); bell.focus(); }
  });

  // --- right rail: route intelligence + drive rhythm
  const renderRight = () => {
    const o = overview(loadTrips(), win);
    const sel = routes.find((r) => r.id === selectedId);
    const slide = routes.find((r) => r.label === "Slide");
    const faster = routes.find((r) => r.label === "Faster");
    let verdict = `<article class="cmd-intel-card neutral"><span class="cmd-ico">${ICON.route}</span><div><em>No route planned</em><b>Search a destination</b><p>Slide ranks the smoothest line within 10% of the fastest time.</p></div></article>`;
    let alt = "";
    if (slide) {
      const both = !faster;
      const diffMin = faster ? Math.round((slide.durationSec - faster.durationSec) / 60) : 0;
      const leftsSaved = faster ? faster.lefts - slide.lefts : 0;
      verdict = `<article class="cmd-intel-card good"><span class="cmd-ico">${ICON.check}</span><div>
        <em>${both ? "Smoothest AND fastest" : "Slide route"}</em>
        <b>${formatDuration(slide.durationSec)} · ${slide.distanceMi.toFixed(1)} mi</b>
        <p>${esc(both ? slide.why : `${leftsSaved > 0 ? `${leftsSaved} fewer left${leftsSaved === 1 ? "" : "s"}, ` : ""}${diffMin > 0 ? `${diffMin} min slower` : "same time"} than fastest · ${slide.why}`)}</p></div></article>`;
      if (faster) {
        alt = `<button type="button" class="cmd-intel-card alt${sel?.id === faster.id ? " on" : ""}" data-route="${faster.id}"><span class="cmd-ico">${ICON.alt}</span><div>
          <em>Faster option</em><b>${formatDuration(faster.durationSec)}</b>
          <p>${faster.lefts} left${faster.lefts === 1 ? "" : "s"} · ${faster.signals} signals · score ${faster.slideScore}</p></div>${ICON.chev}</button>`;
      }
    }
    const onTime = o.onTime;
    const segs = 10;
    const lit = onTime === null ? 0 : Math.round(onTime * segs);
    const sug = suggestSwitch(routes, selectedId);
    const wideIntel = `
      <section class="cmd-card cmd-wide cmd-nav-intel">
        <header><div><h2>Navigation intelligence</h2><p class="cmd-dim">From your planned lines · typical times, no live traffic yet</p></div></header>
        ${sel ? `<div class="cmd-sel"><span class="cmd-dim">${esc(sel.tags.join(" · ") || sel.label)}</span><b>${formatDuration(sel.durationSec)}</b><span>${sel.distanceMi.toFixed(1)} mi · ${sel.lefts} left${sel.lefts === 1 ? "" : "s"} · ${sel.signals} signals${sel.hasToll === true ? " · tolls" : sel.hasToll === false ? " · no tolls" : ""}</span></div>` : `<p class="cmd-empty">Plan a trip to compare lines here.</p>`}
        ${sug ? `<div class="cmd-sug ${sug.savesMin > 0 ? "faster" : "smoother"}"><div><em>${esc(sug.title)}</em><p>${esc(sug.detail)}</p></div><button type="button" class="cmd-switch" data-route="${sug.targetId}">Switch</button></div>`
          : sel && routes.length > 1 ? `<p class="cmd-best"><i class="dot ok"></i>You're on the best line: nothing quicker, nothing smoother within 10%.</p>` : ""}
        <p class="cmd-congestion"><i class="dot"></i>Predicted congestion needs a live traffic provider (not connected).</p>
      </section>
      <section class="cmd-card cmd-wide">
        <header><h2>Alerts</h2><span class="cmd-dim">route, weather, your drives</span></header>
        <ul class="cmd-alert-list"></ul>
      </section>`;
    right.innerHTML = `${wideIntel}
      <section class="cmd-intel">
        <header class="cmd-narrow"><div><h2>Route intelligence</h2><p class="cmd-dim">Scored from Valhalla routes and posted limits. No live traffic yet.</p></div></header>
        <div class="cmd-narrow cmd-intel">${verdict}${alt}</div>
        <article class="cmd-intel-card"><span class="cmd-ico">${ICON.bars}</span><div>
          <em>Arrival accuracy</em><b>${onTime === null ? "—" : `${Math.round(onTime * 100)}%`}</b>
          <p>${onTime === null ? "Shows how close Slide's ETA is to your real arrival." : "Drives that arrived within 2 min of the ETA."}</p>
          <div class="cmd-segbar" aria-hidden="true">${Array.from({ length: segs }, (_, i) => `<i${i < lit ? ' class="on"' : ""}></i>`).join("")}</div>
        </div></article>
      </section>
      <section class="cmd-card cmd-rhythm">
        <header><div><h2>Drive rhythm</h2><p class="cmd-dim">When you drive · ${win}</p></div></header>
        ${hourBars(o.byHour)}
      </section>`;
    right.querySelectorAll<HTMLButtonElement>("[data-route]").forEach((b) => b.addEventListener("click", () => h.onSelectRoute(b.dataset.route!)));
    renderAlerts();
  };

  // --- floating route card over the map (the reference's "Route 14 · 2.5 min")
  const renderRouteCard = () => {
    const card = overlay.querySelector<HTMLElement>(".cmd-route-card")!;
    const sel = routes.find((r) => r.id === selectedId);
    card.hidden = !sel;
    if (!sel) return;
    const posted = sel.bands.map((b) => b.postedMph ?? b.expectedMph).filter((v) => v > 0);
    card.innerHTML = `<header><span class="cmd-ico sm">${ICON.route}</span><span>${sel.label} route</span>${ICON.chev}</header>
      <div class="cmd-rc-body"><div><b>${formatDuration(sel.durationSec)}</b><span>${sel.distanceMi.toFixed(1)} mi · score ${sel.slideScore}</span></div>${sparkSvg(posted, "cmd-spark lg")}</div>`;
  };

  const openSheet = (on: boolean) => {
    document.body.classList.toggle("cmd-sheet", on);
    if (on) {
      renderLeft();
      renderRight();
      sheet.append(left, right);
      sheet.scrollTop = 0;
    } else {
      // Rails live on <body> for the wide layout; put them back when the sheet closes.
      overlay.before(left, right);
    }
  };
  sheetClose.addEventListener("click", () => openSheet(false));

  paintAvatar();
  renderLeft();
  renderRight();
  // The map column changes width when the rails appear.
  window.setTimeout(() => h.map.resize(), 0);
  window.addEventListener("resize", () => h.map.resize());

  return {
    setRoutes(next, id) {
      routes = next;
      selectedId = id;
      renderRight();
      renderRouteCard();
    },
    refreshHistory() {
      paintAvatar();
      renderLeft();
      renderRight();
    },
    openSheet,
  };
}
