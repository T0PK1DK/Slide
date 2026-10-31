/**
 * 390×844: app still opens with no login, Profile shows commute sync status.
 * Usage: node tools/shoot-drive-sync.mjs <outDir> [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "artifacts/drive-sync");
const baseUrl = process.argv[3] || "http://127.0.0.1:4173/";
fs.mkdirSync(outDir, { recursive: true });

const TEST_ID = "00000000-0000-4000-8000-000000000001";
const trips = [
  {
    id: "t1729000000000",
    startedAt: 1_729_000_000_000,
    endedAt: 1_729_000_840_000,
    destLabel: "Work",
    routeLabel: "Slide",
    distanceMi: 6.2,
    plannedSec: 800,
    actualSec: 840,
    slideScore: 82,
    lefts: 3,
    offRouteEvents: 0,
    postedProfile: [45, 35],
    tollRoad: false,
  },
  {
    id: "t1729001000000",
    startedAt: 1_729_001_000_000,
    endedAt: 1_729_001_600_000,
    destLabel: "Home",
    routeLabel: "Faster",
    distanceMi: 6.4,
    plannedSec: 780,
    actualSec: 600,
    slideScore: 70,
    lefts: 5,
    offRouteEvents: 1,
    postedProfile: [55, 40],
    tollRoad: true,
  },
];

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(
    (id, list) => {
      try {
        localStorage.clear();
        localStorage.setItem(`slide.history.v1.${id}`, JSON.stringify(list));
        localStorage.setItem("slide.history.sync.v1", JSON.stringify({ pending: list.map((t) => t.id), synced: [] }));
      } catch {
        /* ignore */
      }
    },
    TEST_ID,
    trips,
  );

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#search-card, #map, .login-card", { timeout: 25000 });
  await page.waitForFunction(() => !document.querySelector(".boot"), { timeout: 12000 }).catch(() => {});
  await page.waitForFunction(async () => {
    const fab = document.querySelector("#menu-fab");
    const ov = document.querySelector("#overflow");
    if (!fab || !ov) return false;
    fab.click();
    const open = ov.classList.contains("open");
    if (open) ov.classList.remove("open", "from-plan");
    return open;
  }, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 400));

  const boot = await page.evaluate(() => ({
    login: Boolean(document.querySelector(".login, .login-card")),
    auth: document.documentElement.dataset.auth || "",
    search: Boolean(document.querySelector("#search-card")),
  }));
  if (boot.login) throw new Error("Login sheet was visible");
  if (boot.auth !== "off") throw new Error(`Expected data-auth=off, got ${boot.auth}`);

  await page.click("#coach-ok").catch(() => {});
  await page.waitForFunction(() => document.querySelector("#coach")?.hidden !== false, { timeout: 5000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, "01-phone-open-straight-in");

  await page.click("#menu-fab");
  await new Promise((r) => setTimeout(r, 200));
  await page.click("#ov-profile");
  await page.waitForSelector(".profile-sheet:not([hidden]) #pf-sync", { timeout: 8000 });
  await page.evaluate(() => document.querySelector("#pf-sync")?.scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 300));
  const profile = await page.evaluate(() => ({
    name: document.querySelector("#pf-name")?.textContent ?? "",
    sync: document.querySelector("#pf-sync")?.textContent ?? "",
    login: Boolean(document.querySelector(".login")),
  }));
  if (profile.login) throw new Error("Login appeared after opening Profile");
  if (!/Test Driver/i.test(profile.name)) throw new Error(`Expected Test Driver, got ${profile.name}`);
  if (!/Commute sync/i.test(profile.sync)) throw new Error(`Missing sync status: ${profile.sync}`);
  await shot(page, "02-phone-profile-sync-status");

  fs.writeFileSync(path.join(outDir, "verify.json"), JSON.stringify({ ok: true, boot, profile }, null, 2));
  console.log("verify ok", JSON.stringify({ boot, profile }, null, 2));
} finally {
  await browser.close();
}
