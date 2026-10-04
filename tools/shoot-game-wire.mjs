/**
 * Mobile shots of Grim's wired game slots.
 * Usage: node tools/shoot-game-wire.mjs <outDir> [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "artifacts/game-wire");
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
};

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
  await page.waitForSelector("#search-card, .login-card", { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".boot"), { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => typeof window.slidePreviewGame === "object", { timeout: 20000 });
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await seed(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await ready(page);
  await page.evaluate(() => document.querySelector(".login")?.remove());

  await page.evaluate(() => window.slidePreviewGame.arrival());
  await new Promise((r) => setTimeout(r, 500));
  await page.waitForSelector("#arr-xp:not([hidden])", { timeout: 5000 });
  await shot(page, "arrival-xp");

  await page.evaluate(() => window.slidePreviewGame.share());
  await new Promise((r) => setTimeout(r, 700));
  await page.waitForSelector("#share-card-mount:not([hidden])", { timeout: 5000 });
  await shot(page, "share-card");

  await page.evaluate(() => window.slidePreviewGame.stage());
  await page.waitForSelector("#car-stage:not([hidden])", { timeout: 5000 });
  await page.waitForFunction(() => {
    const view = document.querySelector("#car-stage .car-stage-view");
    return Boolean(view?.querySelector("canvas, svg"));
  }, { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "car-stage");

  await page.close();
} finally {
  await browser.close();
}
