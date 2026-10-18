/**
 * Phone-size shots of live OSM pins + a place card on the real HUD.
 * Seeds an on-device driver (same as tools/shoot-screens.mjs) and waits on
 * window.slideLookLive after Overpass returns.
 * Usage: node tools/shoot-look-live.mjs [outDir] [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "docs/look");
const baseUrl = (process.argv[3] || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
fs.mkdirSync(outDir, { recursive: true });

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";

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

/** Downtown Fort Lauderdale — dense OSM chains. */
const FTL = { lon: -80.1372, lat: 26.1224, zoom: 14.9 };

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
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
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.map === "ready", { timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.slideLookLive), { timeout: 15000 });
  await page.evaluate((ftl) => {
    document.querySelector(".login")?.remove();
    document.getElementById("search-card")?.classList.remove("open");
    document.getElementById("search-card")?.setAttribute("hidden", "");
    document.getElementById("coach")?.setAttribute("hidden", "");
    document.getElementById("status")?.classList.remove("show");
    window.slideLookLive.flyTo(ftl.lon, ftl.lat, ftl.zoom);
  }, FTL);

  const count = await page.waitForFunction(
    () => (window.slideLookLive?.stores()?.length ?? 0) > 0,
    { timeout: 45000 },
  ).then(() => page.evaluate(() => window.slideLookLive.stores().length))
    .catch(() => 0);

  if (!count) {
    const kind = await page.evaluate(() => window.slideLookLive?.statusKind?.() ?? null);
    const text = await page.evaluate(() => window.slideLookLive?.status?.() ?? "");
    throw new Error(`no live stores after wait (status=${kind} ${text})`);
  }

  const pick = await page.evaluate((ftl) => {
    const stores = window.slideLookLive.stores();
    const branded =
      stores.find((s) => s.brandKey === "publix") ||
      stores.find((s) => s.brandKey === "mcdonalds") ||
      stores.find((s) => s.brandKey === "starbucks") ||
      stores.find((s) => s.brandKey === "walgreens") ||
      stores.find((s) => s.name) ||
      stores[0];
    if (branded) window.slideLookLive.flyTo(branded.lon, branded.lat, 15.45);
    else window.slideLookLive.flyTo(ftl.lon, ftl.lat, 15.2);
    return branded ? { id: branded.id, name: branded.name, brandKey: branded.brandKey } : null;
  }, FTL);
  await page.waitForFunction(() => (window.slideLookLive?.stores()?.length ?? 0) > 0, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1800));
  await shot(page, "live-pins-night");

  const opened = await page.evaluate(async (picked) => {
    const stores = window.slideLookLive.stores();
    const store = (picked && stores.find((s) => s.id === picked.id)) || stores[0];
    if (!store) return null;
    await window.slideLookLive.showStore(store.id);
    return store.name;
  }, pick);
  if (!opened) throw new Error("could not open a live store card");
  await page.waitForSelector("#look-place-card:not([hidden])", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1600));
  await shot(page, "live-card-night");
  console.log("opened", opened, "of", count, "stores");
} finally {
  await browser.close();
}
