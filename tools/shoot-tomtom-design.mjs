/**
 * Before/after HUD shots for the TomTom design pass.
 * After = this build (preview). Before = live site chrome when reachable.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "/opt/cursor/artifacts/tomtom-design");
const afterUrl = process.argv[3] || "http://127.0.0.1:4173/";
const beforeUrl = process.argv[4] || "https://kings-slide.pages.dev/";
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
  tomtomMap: false,
};

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--use-gl=angle",
    "--use-angle=swiftshader-webgl",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
});

async function seed(page) {
  await page.evaluateOnNewDocument(
    (profile, garage) => {
      localStorage.setItem("slide.profile.v1", JSON.stringify(profile));
      localStorage.setItem("slide.session.v1", "on");
      localStorage.setItem("slide.garage.v1", JSON.stringify(garage));
    },
    PROFILE,
    GARAGE,
  );
}

async function ready(page) {
  await page.waitForSelector("#search-card, .login-card, #map-credit", { timeout: 25000 });
  await page.waitForFunction(() => !document.querySelector(".boot"), { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => document.querySelector(".login")?.remove());
  await new Promise((r) => setTimeout(r, 600));
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

function paintPlanHud() {
  document.body.dataset.mode = "plan";
  const credit = document.getElementById("map-credit");
  if (credit) credit.textContent = "© OpenMapTiles © OSM · © TomTom";
}

function paintSearch() {
  document.body.dataset.mode = "plan";
  const credit = document.getElementById("map-credit");
  if (credit) credit.textContent = "© OpenMapTiles © OSM · © TomTom";
  const card = document.getElementById("search-card");
  if (card) card.classList.add("open");
  const box = document.getElementById("to-suggest");
  if (!box) return;
  box.hidden = false;
  box.innerHTML = `
    <button type="button">
      <span class="suggest-name">Bayside Marketplace</span>
      <span class="suggest-dist">1.1 mi</span>
      <span class="suggest-addr">401 Biscayne Blvd, Miami, FL</span>
      <span class="suggest-src">© TomTom</span>
    </button>
    <button type="button">
      <span class="suggest-name">Mary Brickell Village</span>
      <span class="suggest-dist">0.3 mi</span>
      <span class="suggest-addr">901 S Miami Ave, Miami, FL</span>
      <span class="suggest-src">© TomTom</span>
    </button>`;
}

function paintDrive() {
  document.body.dataset.mode = "drive";
  const man = document.getElementById("maneuver");
  if (man) {
    man.hidden = false;
    const md = document.getElementById("man-dist");
    if (md) { md.textContent = "0.4 mi"; md.classList.remove("is-empty"); }
    const instr = document.getElementById("man-instr");
    if (instr) instr.textContent = "Turn right onto Biscayne Blvd";
  }
  const speedo = document.getElementById("speedo");
  if (speedo) {
    speedo.hidden = false;
    document.getElementById("speed-n").textContent = "28";
    const lim = document.getElementById("limit");
    if (lim) {
      lim.classList.remove("unsigned");
      document.getElementById("limit-n").textContent = "35";
    }
  }
  const bar = document.getElementById("drive-bar");
  if (bar) {
    bar.hidden = false;
    const de = document.getElementById("drive-eta");
    if (de) { de.textContent = "12 min"; de.classList.remove("is-empty"); }
    document.getElementById("drive-remain").textContent = "4.1 mi · 4:12 PM";
  }
  const report = document.getElementById("drive-report");
  if (report) report.hidden = false;
  const credit = document.getElementById("map-credit");
  if (credit) credit.textContent = "© OpenMapTiles © OSM · © TomTom";
  const chips = document.getElementById("live-chips");
  const t = document.getElementById("chip-traffic");
  const a = document.getElementById("chip-arrive");
  if (chips && t && a) {
    chips.hidden = false;
    t.hidden = false;
    a.hidden = false;
    t.textContent = "Traffic +6 min";
    a.textContent = "Arrives 4:12 PM";
  }
}

function paintGarage() {
  document.body.dataset.mode = "plan";
  const g = document.getElementById("garage");
  if (g) g.classList.add("open");
}

async function afterWalk(page, tag) {
  await seed(page);
  await page.goto(afterUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await ready(page);
  if (tag === "desktop") await page.waitForSelector("body.cmd .cmd-top", { timeout: 15000 }).catch(() => {});
  await page.evaluate(paintPlanHud);
  await new Promise((r) => setTimeout(r, tag === "desktop" ? 1200 : 400));
  await shot(page, `after-plan-${tag}`);

  await page.evaluate(paintSearch);
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, `after-search-${tag}`);

  await page.evaluate(() => {
    document.getElementById("to-suggest")?.setAttribute("hidden", "");
    document.getElementById("search-card")?.classList.remove("open");
  });
  await page.evaluate(paintDrive);
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, `after-drive-${tag}`);
  const geo = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el || el.hasAttribute("hidden")) return null;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return null;
      const r = el.getBoundingClientRect();
      return r.width < 2 || r.height < 2 ? null : { l: r.left, r: r.right, t: r.top, b: r.bottom };
    };
    const overlap = (a, b) => a && b && a.l < b.r - 2 && a.r > b.l + 2 && a.t < b.b - 2 && a.b > b.t + 2;
    const credit = box("#map-credit");
    const hits = {
      menu: overlap(credit, box("#menu-fab")),
      maneuver: overlap(credit, box("#maneuver")),
      speedo: overlap(credit, box("#speedo")),
      bar: overlap(credit, box("#drive-bar")),
      chipsSpeedo: overlap(box("#live-chips"), box("#speedo")),
      chipsBar: overlap(box("#live-chips"), box("#drive-bar")),
      chipsManeuver: overlap(box("#live-chips"), box("#maneuver")),
    };
    return { credit, hits };
  });
  const bad = Object.entries(geo.hits).filter(([, v]) => v).map(([k]) => k);
  if (bad.length) throw new Error(`${tag} overlap: ${bad.join(", ")}`);
  console.log("geometry ok", tag, geo.credit);

  if (tag === "phone") {
    await page.evaluate(paintGarage);
    await new Promise((r) => setTimeout(r, 300));
    await shot(page, `after-garage-${tag}`);
  }
}

async function beforeWalk(page, tag) {
  await page.goto(beforeUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
  await ready(page).catch(() => {});
  await page.evaluate(() => {
    document.querySelector(".login")?.remove();
    document.body.dataset.mode = "plan";
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, `before-plan-${tag}`);
  await page.evaluate(() => {
    document.body.dataset.mode = "drive";
    const man = document.getElementById("maneuver");
    if (man) man.hidden = false;
    const bar = document.getElementById("drive-bar");
    if (bar) bar.hidden = false;
    const speedo = document.getElementById("speedo");
    if (speedo) speedo.hidden = false;
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, `before-drive-${tag}`);
}

try {
  for (const [w, h, tag] of [[390, 844, "phone"], [1440, 900, "desktop"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 800, hasTouch: w < 800 });
    await afterWalk(page, tag);
    await page.close();
  }
  for (const [w, h, tag] of [[390, 844, "phone"], [1440, 900, "desktop"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 800, hasTouch: w < 800 });
    await beforeWalk(page, tag);
    await page.close();
  }
} finally {
  await browser.close();
}
