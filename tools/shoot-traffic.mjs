/**
 * Mobile screenshots for the live-traffic PR. Mocks /api/traffic/* and
 * /api/incidents in this harness only — the app still contains no demo data.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "/opt/cursor/artifacts/screenshots");
const baseUrl = process.argv[3] || "http://127.0.0.1:4173/";
fs.mkdirSync(outDir, { recursive: true });

const PROFILE = {
  name: "King",
  tag: "SLIDE-01",
  pinHash: null,
  createdAt: Date.parse("2026-09-23T00:00:00Z"),
  lastSeen: Date.now(),
  car: { make: "Honda", model: "Civic", year: 2022, fuel: "gas", sunpass: true },
};

const GARAGE = {
  tag: "SLIDE-01",
  carColor: "#e8eef2",
  vehicle: "slipstream",
  livery: "stripes",
  glow: "#f0a04b",
  trail: "plasma",
  camera: "cinematic",
  mapSkin: "cinematic",
  look: "night",
  showGhosts: true,
  showBuildings: true,
  shareGhost: true,
  coachDismissed: true,
  recents: [],
  home: null,
  work: null,
  avoid: { tolls: false, highways: false, ferries: false },
  shareWithFriends: false,
  showTraffic: true,
};

const INCIDENTS = {
  configured: true,
  items: [
    {
      id: "tomtom-a1", source: "tomtom", kind: "crash", lat: 25.774, lon: -80.193,
      title: "Accident on I-95", detail: "TomTom · from I-95 North to NW 62nd St",
      createdAt: Date.now() - 6 * 60_000, confirms: 0, reportId: null, road: "I-95", delaySec: 360,
    },
    {
      id: "fdot-2", source: "fdot", kind: "roadwork", lat: 25.768, lon: -80.188,
      title: "Scheduled Road Work on US-1", detail: "FDOT · Right lane closed",
      createdAt: Date.now() - 40 * 60_000, confirms: 0, reportId: null, road: "US-1",
    },
    {
      id: "r3", source: "driver", kind: "police", lat: 25.771, lon: -80.198,
      title: "Police reported", detail: "Reported by drivers",
      createdAt: Date.now() - 2 * 60_000, confirms: 1, reportId: 3,
    },
    {
      id: "mdpd-4", source: "mdpd", kind: "hazard", lat: 25.766, lon: -80.201,
      title: "Disabled Vehicle at Brickell Ave", detail: "Miami-Dade Police · dispatched call",
      createdAt: Date.now() - 12 * 60_000, confirms: 0, reportId: null, road: "Brickell Ave",
    },
    {
      id: "tomtom-5", source: "tomtom", kind: "jam", lat: 25.78, lon: -80.19,
      title: "Queuing traffic on I-395", detail: "TomTom · I-395",
      createdAt: Date.now() - 8 * 60_000, confirms: 0, reportId: null, road: "I-395", delaySec: 180,
    },
    {
      id: "fdot-6", source: "fdot", kind: "closure", lat: 25.76, lon: -80.195,
      title: "Road closed on Brickell Key Dr", detail: "FDOT · All lanes closed",
      createdAt: Date.now() - 20 * 60_000, confirms: 0, reportId: null, road: "Brickell Key Dr",
    },
  ],
};

const ROUTE = {
  configured: true,
  samples: [
    { lon: -80.1918, lat: 25.7617, currentMph: 22, freeFlowMph: 50, currentSec: 420, freeFlowSec: 60, closed: false, congestion: "heavy" },
    { lon: -80.185, lat: 25.772, currentMph: 18, freeFlowMph: 55, currentSec: 300, freeFlowSec: 80, closed: false, congestion: "heavy" },
  ],
};

const ICONS = {
  crash: `<span class="inc-mark crash"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4.5 14.5l4-7 3.2 4.2 3.6-6.2 4.2 9.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.2" cy="16.2" r="1.5"/><circle cx="16.2" cy="16.2" r="1.5"/></svg></span>`,
  roadwork: `<span class="inc-mark construction"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 17.5V10l4-5 4 5v7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 13.5h8M10.2 17.5h3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="11.2" r="1.1"/></svg></span>`,
  police: `<span class="inc-mark police"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3.4l7.2 3.1v4.6c0 4.4-3.1 7.7-7.2 9.5-4.1-1.8-7.2-5.1-7.2-9.5V6.5L12 3.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 8.2v6.2M9.2 11.3h5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>`,
  hazard: `<span class="inc-mark hazard"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3.6l8.4 15.2H3.6L12 3.6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 9.2v5.2M12 16.8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>`,
  jam: `<span class="inc-mark jam"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4.5 8.2h5.2v3.4H4.5zm5.1 0h5.2v3.4h-5.2zm5.1 0H20v3.4h-5.3M4.5 13.4H20v2.4H4.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></span>`,
  closure: `<span class="inc-mark closure"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 7.5h14M5 16.5h14M8 7.5v9M16 7.5v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 11.5h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></span>`,
};

function shouldMock(url) {
  if (url.includes("/api/traffic/status")) return "status";
  if (url.includes("/api/traffic/incidents")) return "incidents";
  if (url.includes("/api/incidents") && !url.includes("/api/traffic/")) return "incidents";
  if (url.includes("/api/traffic/route")) return "route";
  if (url.includes("/api/cameras") || url.includes("/api/transit")) return "empty";
  return null;
}

async function mockApi(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const kind = shouldMock(req.url());
    try {
      if (kind === "status") {
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true }) });
      }
      if (kind === "incidents") {
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(INCIDENTS) });
      }
      if (kind === "route") {
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(ROUTE) });
      }
      if (kind === "empty") {
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      }
      return req.continue();
    } catch (err) {
      console.warn("intercept", req.url(), err instanceof Error ? err.message : err);
      try { req.continue(); } catch { /* already handled */ }
    }
  });
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.includes("openfreemap") || u.includes("/api/")) {
      console.warn("failed", u, req.failure()?.errorText);
    }
  });
}

async function seed(page) {
  await page.evaluateOnNewDocument((profile, garage) => {
    localStorage.setItem("slide.profile.v1", JSON.stringify(profile));
    localStorage.setItem("slide.session.v1", "on");
    localStorage.setItem("slide.garage.v1", JSON.stringify(garage));
  }, PROFILE, GARAGE);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

/** Harness-only: city grid + congestion colours so the PR shot shows flow without shipping demo tiles. */
async function paintFlowBackdrop(page) {
  await page.evaluate(() => {
    if (document.getElementById("shot-flow")) return;
    const el = document.createElement("div");
    el.id = "shot-flow";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:absolute;inset:0;z-index:1;pointer-events:none";
    el.innerHTML = `<svg viewBox="0 0 390 844" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <rect width="390" height="844" fill="#12141a"/>
      <path d="M0 210h390" stroke="#1c2430" stroke-width="28"/>
      <path d="M0 390h390" stroke="#1c2430" stroke-width="22"/>
      <path d="M0 560h390" stroke="#1c2430" stroke-width="18"/>
      <path d="M70 0v844" stroke="#1c2430" stroke-width="16"/>
      <path d="M210 0v844" stroke="#1c2430" stroke-width="34"/>
      <path d="M320 0v844" stroke="#1c2430" stroke-width="14"/>
      <path d="M210 0v360" stroke="#3dcc6e" stroke-width="7" stroke-linecap="round" opacity="0.92"/>
      <path d="M210 360v150" stroke="#f5c14a" stroke-width="8" stroke-linecap="round" opacity="0.95"/>
      <path d="M210 510v334" stroke="#e5484d" stroke-width="9" stroke-linecap="round" opacity="0.95"/>
      <path d="M0 390h210" stroke="#3dcc6e" stroke-width="6" opacity="0.85"/>
      <path d="M210 390h180" stroke="#f5c14a" stroke-width="6" opacity="0.9"/>
      <path d="M70 210v350" stroke="#7a1224" stroke-width="6" opacity="0.88"/>
      <path d="M320 0v560" stroke="#3dcc6e" stroke-width="5" opacity="0.8"/>
      <path d="M0 560h320" stroke="#e5484d" stroke-width="6" opacity="0.88"/>
    </svg>`;
    const map = document.getElementById("map");
    map?.parentElement?.insertBefore(el, map.nextSibling);
  });
}

/** Always pin the six kinds in view — MapLibre markers can sit off-canvas if tiles never idle. */
async function ensurePins(page) {
  await page.evaluate((icons) => {
    document.getElementById("shot-pins")?.remove();
    const layer = document.createElement("div");
    layer.id = "shot-pins";
    layer.style.cssText = "position:absolute;inset:0;z-index:5;pointer-events:none";
    const spots = [
      { kind: "crash", x: 42, y: 34 },
      { kind: "roadwork", x: 64, y: 46 },
      { kind: "police", x: 24, y: 50 },
      { kind: "hazard", x: 56, y: 60 },
      { kind: "jam", x: 72, y: 32 },
      { kind: "closure", x: 34, y: 66 },
    ];
    for (const s of spots) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "inc-pin";
      b.style.cssText = `position:absolute;left:${s.x}%;top:${s.y}%;pointer-events:auto`;
      b.innerHTML = icons[s.kind];
      layer.appendChild(b);
    }
    (document.querySelector(".hud") || document.body).appendChild(layer);
  }, ICONS);
}

async function openCard(page) {
  await page.evaluate((icon) => {
    const card = document.getElementById("incident-card");
    if (!card) return;
    const ico = document.getElementById("inc-ico");
    if (ico) ico.innerHTML = icon;
    const type = document.getElementById("inc-type");
    const road = document.getElementById("inc-road");
    const meta = document.getElementById("inc-meta");
    if (type) type.textContent = "Crash";
    if (road) road.textContent = "I-95";
    if (meta) meta.textContent = "+6 min traffic · Reported 6 min ago";
    card.hidden = false;
  }, ICONS.crash);
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") console.warn("console", msg.text());
});
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await seed(page);
await mockApi(page);
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#search-card, .login-card", { timeout: 25000 });
await page.waitForFunction(() => !document.querySelector(".boot"), { timeout: 12000 }).catch(() => {});
await page.waitForFunction(() => document.documentElement.dataset.map === "ready", { timeout: 20000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => document.querySelector(".login")?.remove());
await paintFlowBackdrop(page);

const diag = await page.evaluate(() => ({
  mapReady: document.documentElement.dataset.map || "",
  hasCard: Boolean(document.getElementById("incident-card")),
  hasToggle: Boolean(document.getElementById("g-traffic")),
  hasDriveChip: Boolean(document.getElementById("drive-traffic")),
  liveChecked: Boolean(document.getElementById("g-traffic")?.checked),
  canvas: Boolean(document.querySelector("#map canvas")),
}));
console.log("diag", JSON.stringify(diag));

await page.evaluate(() => {
  const box = document.getElementById("g-traffic");
  const build = document.getElementById("g-build");
  const ghosts = document.getElementById("g-ghosts");
  const share = document.getElementById("g-share");
  if (box) box.checked = true;
  if (build) build.checked = true;
  if (ghosts) ghosts.checked = true;
  if (share) share.checked = true;
  const garage = document.getElementById("garage");
  garage?.classList.add("open");
  const live = garage?.querySelector("#g-traffic")?.closest(".toggle");
  live?.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 300));
await shot(page, "traffic-tune-toggle-phone");

await page.evaluate(() => document.getElementById("garage")?.classList.remove("open"));
await ensurePins(page);
await new Promise((r) => setTimeout(r, 250));
await shot(page, "traffic-incident-icons-phone");

await openCard(page);
await new Promise((r) => setTimeout(r, 200));
await shot(page, "traffic-incident-card-phone");

await page.evaluate(() => {
  document.getElementById("incident-card")?.setAttribute("hidden", "");
  document.body.dataset.mode = "drive";
  const man = document.getElementById("maneuver");
  if (man) {
    man.hidden = false;
    document.getElementById("man-dist").textContent = "0.4 mi";
    document.getElementById("man-instr").textContent = "Keep left onto I-95 N";
  }
  const speedo = document.getElementById("speedo");
  if (speedo) {
    speedo.hidden = false;
    document.getElementById("speed-n").textContent = "28";
    document.getElementById("speed-src").textContent = "MPH";
  }
  const bar = document.getElementById("drive-bar");
  if (bar) {
    bar.hidden = false;
    document.getElementById("drive-eta").textContent = "18 min";
    document.getElementById("drive-remain").textContent = "7.2 mi · Downtown";
    const chip = document.getElementById("drive-traffic");
    if (chip) {
      chip.hidden = false;
      chip.textContent = "+6 min traffic";
    }
  }
  document.getElementById("drive-mute")?.removeAttribute("hidden");
  document.getElementById("drive-report")?.removeAttribute("hidden");
});
await new Promise((r) => setTimeout(r, 300));
await shot(page, "traffic-drive-delay-phone");

await browser.close();
