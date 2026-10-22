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

  await night.evaluate(() => window.slideLook.showPlace("osm:node/dunkin-1"));
  await new Promise((r) => setTimeout(r, 700));
  await shot(night, "card-closed-night");

  await night.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showGhosts(false);
    window.slideLook.zoom(16.45, [-80.1362, 26.1186]);
    window.slideLook.selectPin("osm:node/shell-1");
  });
  await new Promise((r) => setTimeout(r, 900));
  await shot(night, "pins-collide-night");

  await night.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showGhosts(false);
    window.slideLook.zoom(15.35, [-80.1362, 26.1186]);
    window.slideLook.focusPin("osm:node/shell-1");
  });
  await new Promise((r) => setTimeout(r, 800));
  await shot(night, "pins-cluster-tap-night");

  await night.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showGhosts(false);
    window.slideLook.zoom(15.15, [-80.1362, 26.1186]);
    window.slideLook.focusPin("osm:node/shell-1");
  });
  await new Promise((r) => setTimeout(r, 800));
  await shot(night, "pins-cluster-after-night");
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
  await day.evaluate(() => {
    window.slideLook.trigger("close");
    window.slideLook.showSkel(true);
  });
  await new Promise((r) => setTimeout(r, 500));
  await shot(day, "pins-skel-day");
  await day.close();

  const hud = await browser.newPage();
  await hud.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await hud.goto(`${baseUrl}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await hud.waitForSelector("#search-card, .login-card, #place-card", { timeout: 20000 }).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 800));
  await hud.evaluate(() => {
    document.querySelector(".login")?.remove();
    document.body.dataset.mode = "plan";
    document.getElementById("place-card")?.setAttribute("hidden", "");
    const card = document.getElementById("search-card");
    card?.classList.add("open");
    card?.removeAttribute("hidden");
    document.getElementById("to-suggest")?.setAttribute("hidden", "");
    const recents = document.getElementById("recents");
    if (recents) {
      recents.hidden = false;
      recents.innerHTML = `<div class="recents-label">Recent</div><p class="suggest-status is-empty">Places you pick will show here</p>`;
    }
    const home = document.getElementById("chip-home");
    const work = document.getElementById("chip-work");
    if (home) home.innerHTML = `<span class="suggest-name">Home</span><span class="suggest-addr">Save a place on this phone</span>`;
    if (work) work.innerHTML = `<span class="suggest-name">Work</span><span class="suggest-addr">Save a place on this phone</span>`;
    document.getElementById("chip-saved")?.setAttribute("hidden", "");
  });
  await new Promise((r) => setTimeout(r, 350));
  await shot(hud, "search-empty-night");

  await hud.evaluate(() => {
    const box = document.getElementById("to-suggest");
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<p class="suggest-status is-empty">No match, try adding the city</p>`;
  });
  await new Promise((r) => setTimeout(r, 300));
  await shot(hud, "search-no-results-night");

  await hud.evaluate(() => {
    document.getElementById("to-suggest")?.setAttribute("hidden", "");
    const recents = document.getElementById("recents");
    if (recents) {
      recents.hidden = false;
      recents.innerHTML = `
        <div class="recents-label">Recent</div>
        <button type="button" class="recent-item">
          <span class="suggest-name">Bayside Marketplace</span>
          <span class="suggest-addr">401 Biscayne Blvd, Miami</span>
        </button>
        <button type="button" class="recent-item">
          <span class="suggest-name">Mary Brickell Village</span>
          <span class="suggest-addr">901 S Miami Ave, Miami</span>
        </button>`;
    }
    const home = document.getElementById("chip-home");
    if (home) home.innerHTML = `<span class="suggest-name">Home</span><span class="suggest-addr">9601 Collins Ave, Miami Beach</span>`;
    const box = document.getElementById("to-suggest");
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `
      <button type="button">
        <span class="suggest-name">Bayside Marketplace</span>
        <span class="suggest-dist">0.4 mi</span>
        <span class="suggest-addr">401 Biscayne Blvd, Miami</span>
      </button>
      <button type="button" class="active">
        <span class="suggest-name">Our Lady of Guadalupe Catholic Church and Community Center</span>
        <span class="suggest-dist">1.1 mi</span>
        <span class="suggest-addr">901 S Miami Ave, Miami</span>
      </button>
      <button type="button">
        <span class="suggest-name">Brickell City Centre</span>
        <span class="suggest-addr">701 S Miami Ave, Miami</span>
      </button>`;
  });
  await new Promise((r) => setTimeout(r, 400));
  await shot(hud, "search-results-night");

  await hud.evaluate(() => {
    document.getElementById("to-suggest")?.setAttribute("hidden", "");
    document.getElementById("search-card")?.classList.remove("open");
    const sheet = document.getElementById("net-sheet");
    if (!sheet) return;
    sheet.hidden = false;
    sheet.dataset.kind = "offline";
    const t = document.getElementById("net-title");
    const m = document.getElementById("net-msg");
    if (t) t.textContent = "You're offline";
    if (m) t && (m.textContent = "Slide will retry when the phone has a connection.");
  });
  await new Promise((r) => setTimeout(r, 350));
  await shot(hud, "search-offline-night");

  await hud.evaluate(() => {
    document.getElementById("to-suggest")?.setAttribute("hidden", "");
    document.getElementById("search-card")?.classList.remove("open");
    document.getElementById("net-sheet")?.setAttribute("hidden", "");
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

  await hud.evaluate(() => {
    const extras = document.getElementById("place-extras");
    if (!extras) return;
    extras.hidden = false;
    const mark =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="72" fill="#3d8b40"/><text x="100" y="118" text-anchor="middle" font-size="72" fill="#fff" font-family="system-ui">P</text></svg>',
      );
    extras.innerHTML = `
      <div class="place-extras-meta">
        <span class="look-chip look-chip-open">Open · closes 11p</span>
        <p class="place-hours">Daily 6a–11p</p>
      </div>
      <div class="look-photos" role="list">
        <figure class="look-photo is-logo is-mark" title="Wikimedia Commons · Publix_logo.svg">
          <img src="${mark}" alt="Logo" referrerpolicy="no-referrer" />
          <figcaption><span class="look-photo-kind">Logo</span><span class="look-photo-credit">Wikimedia</span></figcaption>
        </figure>
      </div>`;
  });
  await new Promise((r) => setTimeout(r, 350));
  await shot(hud, "search-card-extras-night");
  await hud.close();
} finally {
  await browser.close();
}
