/**
 * Mobile (390×844) shots of the in-drive reroute prompt in Night / Ember / Sand.
 * Mocks live only in this script — never in app code.
 * Usage: node tools/shoot-reroute.mjs <outDir> [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "artifacts/reroute");
const baseUrl = process.argv[3] || "http://127.0.0.1:5173/";
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
  suggestReroute: true,
};

async function seed(page, look) {
  await page.evaluateOnNewDocument(
    (profile, garage, look) => {
      localStorage.setItem("slide.profile.v1", JSON.stringify(profile));
      localStorage.setItem("slide.session.v1", "on");
      localStorage.setItem("slide.garage.v1", JSON.stringify({ ...garage, look }));
    },
    PROFILE,
    GARAGE,
    look,
  );
}

async function ready(page) {
  await page.waitForSelector("#search-card, .login-card", { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".boot"), { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => typeof window.slidePreviewGame === "object", { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
}

async function showDrivePrompt(page, look) {
  await page.evaluate((look) => {
    document.documentElement.dataset.look = look;
    document.querySelector(".login")?.remove();
    document.getElementById("garage")?.classList.remove("open");
    document.body.dataset.mode = "drive";
    const man = document.getElementById("maneuver");
    if (man) {
      man.hidden = false;
      const md = document.getElementById("man-dist");
      if (md) { md.textContent = "0.6 mi"; md.classList.remove("is-empty"); }
      const instr = document.getElementById("man-instr");
      if (instr) instr.textContent = "Keep left onto I-95 N";
    }
    const posted = document.getElementById("posted");
    if (posted) { posted.hidden = false; posted.textContent = "Hold 55 → 45 in 0.4 mi"; }
    const speedo = document.getElementById("speedo");
    if (speedo) {
      speedo.hidden = false;
      const n = document.getElementById("speed-n");
      if (n) n.textContent = "52";
      const src = document.getElementById("speed-src");
      if (src) src.textContent = "MPH";
      const lim = document.getElementById("limit");
      if (lim) {
        lim.hidden = false;
        lim.classList.remove("unsigned");
        const ln = document.getElementById("limit-n");
        if (ln) ln.textContent = "55";
      }
    }
    const bar = document.getElementById("drive-bar");
    if (bar) {
      bar.hidden = false;
      const de = document.getElementById("drive-eta");
      if (de) { de.textContent = "18 min"; de.classList.remove("is-empty"); }
      const remain = document.getElementById("drive-remain");
      if (remain) remain.textContent = "9.4 mi · downtown";
      const chip = document.getElementById("drive-traffic");
      if (chip) { chip.hidden = false; chip.textContent = "Crash in 1.2 mi, +6 min"; }
    }
    const mute = document.getElementById("drive-mute");
    if (mute) mute.hidden = false;
    const report = document.getElementById("drive-report");
    if (report) report.hidden = false;
    const card = document.getElementById("reroute-card");
    const line = document.getElementById("rr-line");
    if (line) line.textContent = "Faster route · saves 6 min · crash on I-95";
    if (card) {
      card.hidden = false;
      card.setAttribute("aria-label", "Faster route · saves 6 min · crash on I-95");
    }
  }, look);
  await new Promise((r) => setTimeout(r, 350));
}

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  for (const look of ["night", "ember", "sand"]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await seed(page, look);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await ready(page);
    await showDrivePrompt(page, look);
    const file = path.join(outDir, `reroute-${look}-390.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("wrote", file);
    if (look === "night") {
      await page.evaluate(() => {
        document.body.dataset.mode = "plan";
        document.getElementById("reroute-card").hidden = true;
        document.getElementById("drive-bar").hidden = true;
        document.getElementById("speedo").hidden = true;
        document.getElementById("maneuver").hidden = true;
        document.getElementById("garage")?.classList.add("open");
        const row = document.getElementById("g-reroute-row");
        if (row) row.scrollIntoView({ block: "center" });
      });
      await new Promise((r) => setTimeout(r, 250));
      const garage = path.join(outDir, "garage-reroute-toggle-390.png");
      await page.screenshot({ path: garage, fullPage: false });
      console.log("wrote", garage);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
