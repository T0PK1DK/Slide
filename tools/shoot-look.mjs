/**
 * Phone-size shots of the Slide look demo (pins, cards, hologram, ghosts).
 * Same harness as tools/shoot-screens.mjs (puppeteer-core + system Chrome).
 * Usage: node tools/shoot-look.mjs [outDir] [baseUrl]
 * Default outDir: docs/look
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "docs/look");
const baseUrl = (process.argv[3] || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
fs.mkdirSync(outDir, { recursive: true });

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

async function openLook(browser, look) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const url = `${baseUrl}look.html?look=${look}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.lookReady === "1", { timeout: 45000 });
  await page.waitForFunction(() => window.slideLook && window.slideLook.ready, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1400));
  return page;
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  const night = await openLook(browser, "night");
  await shot(night, "pins-night");

  await night.evaluate(() => window.slideLook.showPlace("osm:node/123"));
  await new Promise((r) => setTimeout(r, 700));
  await shot(night, "card-full-night");

  await night.evaluate(() => window.slideLook.showPlace("osm:node/corner-1"));
  await new Promise((r) => setTimeout(r, 500));
  await shot(night, "card-empty-night");

  await night.evaluate(() => window.slideLook.showLoading("osm:node/123"));
  await new Promise((r) => setTimeout(r, 400));
  await shot(night, "card-loading-night");

  await night.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showSkel(true);
  });
  await new Promise((r) => setTimeout(r, 700));
  await shot(night, "pins-skel-night");
  await night.evaluate(() => window.slideLook.showSkel(false));

  await night.evaluate(() => window.slideLook.previewMotion("enter"));
  await new Promise((r) => setTimeout(r, 250));
  await shot(night, "motion-enter-night");

  await night.evaluate(() => window.slideLook.previewMotion("reveal"));
  await new Promise((r) => setTimeout(r, 250));
  await shot(night, "motion-reveal-night");

  await night.evaluate(() => window.slideLook.trigger("close"));
  await new Promise((r) => setTimeout(r, 520));
  await night.evaluate(() => window.slideLook.previewMotion("drop"));
  await new Promise((r) => setTimeout(r, 260));
  await shot(night, "motion-drop-night");

  await night.evaluate(() => window.slideLook.previewMotion("select"));
  await new Promise((r) => setTimeout(r, 260));
  await shot(night, "motion-select-night");

  await night.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showGhosts(true);
    window.slideLook.zoom(15.6);
  });
  await new Promise((r) => setTimeout(r, 600));
  await shot(night, "ghosts-night");

  await night.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showGhosts(false);
    window.slideLook.zoom(13.45);
  });
  await new Promise((r) => setTimeout(r, 800));
  await shot(night, "clusters-night");

  await night.evaluate(() => window.slideLook.zoom(13.05));
  await new Promise((r) => setTimeout(r, 800));
  await shot(night, "clusters-out-night");
  await night.close();

  const day = await openLook(browser, "day");
  await shot(day, "pins-day");
  await day.evaluate(() => window.slideLook.showPlace("osm:node/123"));
  await new Promise((r) => setTimeout(r, 700));
  await shot(day, "card-full-day");
  await day.evaluate(() => window.slideLook.showPlace("osm:node/corner-1"));
  await new Promise((r) => setTimeout(r, 500));
  await shot(day, "card-empty-day");
  await day.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showGhosts(false);
    window.slideLook.zoom(13.45);
  });
  await new Promise((r) => setTimeout(r, 800));
  await shot(day, "clusters-day");
  await day.close();

  const hud = await browser.newPage();
  await hud.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await hud.goto(`${baseUrl}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await hud.waitForSelector("#search-card, .login-card, #place-card", { timeout: 20000 }).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 800));
  await hud.evaluate(() => {
    document.querySelector(".login")?.remove();
    document.body.dataset.mode = "plan";
    const p = document.getElementById("place-card");
    if (!p) return;
    p.hidden = false;
    const n = document.getElementById("place-name");
    const a = document.getElementById("place-addr");
    if (n) n.textContent = "Bayside Marketplace";
    if (a) a.textContent = "401 Biscayne Blvd, Miami";
  });
  await new Promise((r) => setTimeout(r, 400));
  await shot(hud, "search-card-night");
  await hud.close();
} finally {
  await browser.close();
}
