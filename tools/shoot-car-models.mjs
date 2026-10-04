/**
 * Mobile shots of the original 3D rides.
 * Usage: node tools/shoot-car-models.mjs <outDir> [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "artifacts/car-models");
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

const SHOTS = [
  { file: "slipstream-stripes", id: "slipstream", livery: "stripes" },
  { file: "brawler-fade", id: "brawler", livery: "fade" },
  { file: "pocket-stripes", id: "hatch", livery: "stripes" },
  { file: "ridge-solid", id: "ridge", livery: "solid" },
  { file: "hauler-dusk", id: "hauler", livery: "dusk" },
  { file: "classic-halo", id: "classic", livery: "halo" },
  { file: "nimbus-stripes", id: "nimbus", livery: "stripes" },
  { file: "glider-fade", id: "glider", livery: "fade" },
];

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: [
    "--no-sandbox",
    "--hide-scrollbars",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(
    (profile, garage) => {
      localStorage.setItem("slide.profile.v1", JSON.stringify(profile));
      localStorage.setItem("slide.session.v1", "on");
      localStorage.setItem("slide.garage.v1", JSON.stringify(garage));
    },
    PROFILE,
    GARAGE,
  );
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof window.slidePreviewGame?.ride === "function", { timeout: 20000 });
  await page.evaluate(() => {
    document.querySelector(".login")?.remove();
    document.documentElement.dataset.stageHold = "1";
  });

  for (const shot of SHOTS) {
    await page.evaluate((id, livery) => window.slidePreviewGame.ride(id, livery), shot.id, shot.livery);
    await page.waitForSelector("#car-stage:not([hidden])", { timeout: 5000 });
    await page.waitForFunction(() => Boolean(document.querySelector("#car-stage .car-stage-view canvas, #car-stage .car-stage-view svg")), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1100));
    const file = path.join(outDir, `${shot.file}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("wrote", file);
  }
  await page.close();
} finally {
  await browser.close();
}
