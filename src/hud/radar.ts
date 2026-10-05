import type { Fix } from "../lib/tracking";
import { cloudConfigured } from "../lib/cloud";
import {
  ago,
  nextAlert,
  officialIncidents,
  radarBlips,
  REPORT_KINDS,
  reportsNear,
  submitReport,
  voteReport,
  type Blip,
  type RadarItem,
  enforcementCameras,
  transitVehicles,
  type RadarKind,
  type ReportableKind,
} from "../lib/reports";
import { currentUserId } from "../lib/social";
import { REPORT_SUBTYPES, reportKindIcon } from "./report-ui";

/**
 * The game-style mini radar: heading-up, range rings, a sweep, and a blip for
 * every real report around you (drivers' reports + official FDOT / Miami-Dade Police incidents).
 * A heads-up banner fires once per item when something alert-worthy is ahead
 * within ~0.8 mi. It never tells the driver to change speed — it only says
 * what's there. Reporting is one tap per kind.
 */
export type RadarHooks = {
  getFix: () => Fix | null;
  /** Map centre — official incidents still load before GPS locks (the phone bug). */
  getCenter?: () => { lat: number; lon: number };
  /** Opens the profile so a signed-out driver can sign in before reporting. */
  openProfile: () => void;
};

export type RadarView = {
  refresh(): void;
  setMode(mode: "plan" | "review" | "drive" | "arrive"): void;
  openReport(): void;
};

const RANGE_MI = 1.5;
const POLL_MS = 45_000;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const GLYPH: Record<RadarKind, string> = {
  police: `<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>`,
  crash: `<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01" stroke="#07080a"/>`,
  hazard: `<path d="M12 3l9 16H3z"/>`,
  closure: `<rect x="4" y="8" width="16" height="8" rx="2"/>`,
  jam: `<circle cx="12" cy="12" r="7"/>`,
  roadwork: `<path d="M4 20h16L12 4z"/>`,
  camera: `<rect x="3" y="7" width="14" height="10" rx="2"/><path d="M17 10l4-2v8l-4-2z"/>`,
  bus: `<rect x="5" y="4" width="14" height="15" rx="3"/>`,
  rail: `<rect x="6" y="3" width="12" height="15" rx="4"/><path d="M8 21l2-3M16 21l-2-3" stroke="currentColor" stroke-width="2"/>`,
};

export function mountRadar(h: RadarHooks): RadarView {
  const root = document.createElement("div");
  root.className = "radar";
  root.hidden = true;
  root.innerHTML = `
    <button type="button" class="radar-disc" aria-label="Nearby reports" aria-haspopup="dialog">
      <svg viewBox="-50 -50 100 100" class="radar-svg" aria-hidden="true">
        <circle r="48" class="ring outer"/><circle r="32" class="ring"/><circle r="16" class="ring"/>
        <line x1="0" y1="-48" x2="0" y2="48" class="axis"/><line x1="-48" y1="0" x2="48" y2="0" class="axis"/>
        <g class="sweep"><path d="M0 0 L0 -48 A48 48 0 0 1 34 -34 Z"/></g>
        <g class="blips"></g>
        <path d="M0 -6 L5 5 L0 2.5 L-5 5 Z" class="me"/>
      </svg>
      <span class="radar-count" hidden></span>
    </button>
    <button type="button" class="radar-report" aria-label="Report something on the road">Report</button>`;
  const banner = document.createElement("div");
  banner.className = "radar-banner";
  banner.setAttribute("role", "alert");
  banner.hidden = true;
  const sheet = document.createElement("div");
  sheet.className = "radar-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", "Radar");
  sheet.hidden = true;
  document.body.append(root, banner, sheet);

  let items: RadarItem[] = [];
  let blips: Blip[] = [];
  let lastPollAt = 0;
  let lastPollPos: { lat: number; lon: number } | null = null;
  let polling = false;
  let mode: "plan" | "review" | "drive" | "arrive" = "plan";
  const alerted = new Set<string>();
  let bannerTimer = 0;

  const poll = async (pos: { lat: number; lon: number }) => {
    if (polling) return;
    polling = true;
    lastPollAt = Date.now();
    lastPollPos = pos;
    const [drivers, official, cameras, transit] = await Promise.all([
      reportsNear(pos.lat, pos.lon).catch(() => [] as RadarItem[]),
      officialIncidents(pos.lat, pos.lon),
      enforcementCameras(pos.lat, pos.lon),
      transitVehicles(pos.lat, pos.lon),
    ]);
    items = [...drivers, ...official, ...cameras, ...transit];
    polling = false;
    draw();
  };

  const draw = () => {
    const fix = h.getFix();
    root.hidden = !fix || mode === "arrive";
    if (!fix) return;
    blips = radarBlips(items, fix.pos, fix.speedMph > 2 ? fix.headingDeg : null, RANGE_MI);
    root.querySelector(".blips")!.innerHTML = blips
      .map((b) => `<g class="blip ${b.kind} ${b.source}" transform="translate(${(b.x * 44).toFixed(1)} ${(b.y * 44).toFixed(1)}) scale(.42)"><g transform="translate(-12 -12)">${GLYPH[b.kind]}</g></g>`)
      .join("");
    const ahead = blips.filter((b) => b.ahead).length;
    const count = root.querySelector<HTMLElement>(".radar-count")!;
    count.hidden = blips.length === 0;
    count.textContent = ahead ? `${ahead} ahead` : `${blips.length} near`;
    root.querySelector(".radar-disc")!.setAttribute("aria-label", blips.length ? `Nearby reports: ${blips.length}, ${ahead} ahead` : "Nearby reports: none");
    if (mode === "drive") maybeAlert();
  };

  const maybeAlert = () => {
    const b = nextAlert(blips, alerted);
    if (!b) return;
    alerted.add(b.id);
    banner.innerHTML = `<span class="rb-dot ${b.kind}"></span><div><b>${esc(b.title)} ahead · ${b.distMi.toFixed(1)} mi</b><span>${esc(b.detail)}${b.createdAt ? ` · ${ago(b.createdAt)}` : ""}</span></div>`;
    banner.hidden = false;
    try { navigator.vibrate?.([80, 60, 80]); } catch { /* not supported */ }
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => { banner.hidden = true; }, 8000);
  };

  const openList = () => {
    const fix = h.getFix();
    const rows = blips.length
      ? blips.map((b) => `<li class="rs-item"><span class="rb-dot ${b.kind}"></span><div><b>${esc(b.title)}</b><span>${b.distMi.toFixed(1)} mi${b.ahead ? " ahead" : ""}${b.createdAt ? ` · ${ago(b.createdAt)}` : ""} · ${esc(b.detail)}</span>
          ${b.reportId !== null ? `<div class="rs-votes"><button type="button" data-vote="${b.reportId}" data-yes="1">Still there</button><button type="button" data-vote="${b.reportId}" data-yes="0">Not there</button></div>` : ""}</div></li>`).join("")
      : `<li class="rs-empty">${fix ? "Nothing reported within 1.5 mi." : "Turn on location to see what's around you."}</li>`;
    sheet.innerHTML = `<div class="rs-card">
      <header><h2>Radar</h2><button type="button" class="rs-close" aria-label="Close">×</button></header>
      <p class="rs-src">Driver reports${cloudConfigured() ? "" : " (accounts not set up on this build)"} · official incidents from FDOT and Miami-Dade Police (FL511 when keyed) · cameras mapped in OpenStreetMap (may be incomplete) · live buses and trains where agencies publish them. Slide never tracks police vehicles; police items are reports from other drivers.</p>
      <ul class="rs-list">${rows}</ul>
      <p class="rs-msg" role="status"></p>
    </div>`;
    sheet.hidden = false;
    sheet.querySelector<HTMLElement>(".rs-close")!.focus();
    sheet.querySelector(".rs-close")!.addEventListener("click", closeSheet);
    sheet.querySelectorAll<HTMLButtonElement>("[data-vote]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const msg = sheet.querySelector<HTMLElement>(".rs-msg")!;
        try {
          await voteReport(Number(btn.dataset.vote), btn.dataset.yes === "1");
          msg.textContent = "Thanks — that helps other drivers.";
          const f = h.getFix();
          if (f) void poll(f.pos);
        } catch (e) {
          msg.textContent = e instanceof Error ? e.message : "Couldn't send that.";
        }
      })
    );
  };

  const openReport = async () => {
    const fix = h.getFix();
    if (!fix) return;
    if (!cloudConfigured() || !(await currentUserId().catch(() => null))) {
      sheet.innerHTML = `<div class="rs-card"><header><h2>Report</h2><button type="button" class="rs-close" aria-label="Close">×</button></header>
        <p class="rs-src">${cloudConfigured() ? "Sign in on your Profile to report, so reports stay trustworthy." : "Reporting turns on once Slide accounts are set up on this build."}</p>
        ${cloudConfigured() ? `<button type="button" class="rs-signin">Open Profile to sign in</button>` : ""}</div>`;
      sheet.hidden = false;
      sheet.querySelector(".rs-close")!.addEventListener("click", closeSheet);
      sheet.querySelector(".rs-signin")?.addEventListener("click", () => { closeSheet(); h.openProfile(); });
      return;
    }
    const drawKinds = () => {
      sheet.innerHTML = `<div class="rs-card"><header><h2>What's on the road?</h2><button type="button" class="rs-close" aria-label="Close">×</button></header>
        <div class="rs-kinds">${REPORT_KINDS.map((k) => `<button type="button" class="rs-kind" data-kind="${k.kind}">${reportKindIcon(k.kind)}<span>${k.label}</span></button>`).join("")}</div>
        <p class="rs-src">Reported at your current spot. Your name is never shown with a report.</p>
        <p class="rs-msg" role="status"></p></div>`;
      sheet.querySelector(".rs-close")!.addEventListener("click", closeSheet);
      sheet.querySelectorAll<HTMLButtonElement>(".rs-kind").forEach((btn) =>
        btn.addEventListener("click", () => drawSubtypes(btn.dataset.kind as ReportableKind))
      );
    };
    const drawSubtypes = (kind: ReportableKind) => {
      const meta = REPORT_KINDS.find((k) => k.kind === kind)!;
      const subs = REPORT_SUBTYPES[kind];
      sheet.innerHTML = `<div class="rs-card"><header><h2>${esc(meta.label)}</h2><button type="button" class="rs-close" aria-label="Close">×</button></header>
        <div class="rs-hero">${reportKindIcon(kind)}</div>
        <p class="rs-src">Pick what you see, then Send. Slide still files this as ${esc(meta.label.toLowerCase())} — subtypes stay on this phone.</p>
        <div class="rs-subs">${subs.map((s) => `<button type="button" class="rs-sub" data-sub="${s.id}">${esc(s.label)}</button>`).join("")}</div>
        <div class="rs-send">
          <button type="button" class="ghost" id="rs-later">Later</button>
          <button type="button" class="primary" id="rs-send" disabled>Send</button>
        </div>
        <p class="rs-msg" role="status"></p></div>`;
      sheet.querySelector(".rs-close")!.addEventListener("click", closeSheet);
      sheet.querySelector("#rs-later")!.addEventListener("click", closeSheet);
      let picked = "";
      const send = sheet.querySelector<HTMLButtonElement>("#rs-send")!;
      sheet.querySelectorAll<HTMLButtonElement>(".rs-sub").forEach((btn) =>
        btn.addEventListener("click", () => {
          picked = btn.dataset.sub || "";
          sheet.querySelectorAll(".rs-sub").forEach((b) => b.classList.toggle("on", b === btn));
          send.disabled = !picked;
        })
      );
      send.addEventListener("click", async () => {
        const f = h.getFix();
        const msg = sheet.querySelector<HTMLElement>(".rs-msg")!;
        if (!f) { msg.textContent = "Waiting for your location…"; return; }
        send.disabled = true;
        try {
          await submitReport(kind, f.pos.lat, f.pos.lon, f.headingDeg);
          const sub = subs.find((s) => s.id === picked)?.label ?? "";
          msg.textContent = sub ? `Reported ${meta.label.toLowerCase()} · ${sub}. Thanks for looking out.` : "Reported. Thanks for looking out.";
          void poll(f.pos);
          window.setTimeout(closeSheet, 900);
        } catch (e) {
          msg.textContent = e instanceof Error ? e.message : "Couldn't report right now.";
          send.disabled = false;
        }
      });
    };
    drawKinds();
    sheet.hidden = false;
  };

  const closeSheet = () => { sheet.hidden = true; };
  sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
  root.querySelector(".radar-disc")!.addEventListener("click", openList);
  root.querySelector(".radar-report")!.addEventListener("click", () => void openReport());
  banner.addEventListener("click", () => { banner.hidden = true; openList(); });

  const tick = () => {
    const fix = h.getFix();
    const pos = fix?.pos ?? h.getCenter?.();
    if (pos && !document.hidden) {
      const moved = lastPollPos ? Math.hypot(pos.lat - lastPollPos.lat, pos.lon - lastPollPos.lon) > 0.01 : true;
      if (Date.now() - lastPollAt > POLL_MS || moved) void poll(pos);
    }
    draw();
  };
  window.setInterval(tick, 2000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

  return {
    refresh: tick,
    setMode(m) {
      mode = m;
      root.dataset.mode = m;
      if (m !== "drive") banner.hidden = true;
      draw();
    },
    openReport() { void openReport(); },
  };
}
