/**
 * Prove the app opens straight into the HUD with no sign-in sheet.
 * Usage: node tools/shoot-test-account.mjs <outDir> [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "artifacts/test-account");
const baseUrl = process.argv[3] || "http://127.0.0.1:4173/";
fs.mkdirSync(outDir, { recursive: true });

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

function log(name, file) {
  console.log("wrote", file);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log(name, file);
  return file;
}

const notes = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  // Empty storage: first visit must not show a login card.
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#search-card, #map, .login-card", { timeout: 25000 });
  await page.waitForFunction(() => !document.querySelector(".boot"), { timeout: 12000 }).catch(() => {});
  // main.ts wires the menu after the dynamic import; wait until a click opens it.
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
    lockHidden: !document.querySelector("#ov-lock") || document.querySelector("#ov-lock").hidden,
    testUser: (() => {
      try {
        return localStorage.getItem("slide.profile.v1.00000000-0000-4000-8000-000000000001");
      } catch {
        return null;
      }
    })(),
  }));
  notes.push(boot);
  if (boot.login) throw new Error("Login sheet was visible on first open");
  if (boot.auth !== "off") throw new Error(`Expected data-auth=off, got ${boot.auth}`);
  if (!boot.search) throw new Error("Main search card missing — not in the app");
  if (!boot.lockHidden) throw new Error("#ov-lock is visible while auth is off");
  if (!boot.testUser) throw new Error("Test profile was not written under the scoped key");

  await shot(page, "01-phone-first-paint-no-login");
  // Coach is first-run help, not a sign-in gate. Dismiss it so the HUD is visible.
  await page.click("#coach-ok").catch(() => {});
  await page.waitForFunction(() => document.querySelector("#coach")?.hidden !== false, { timeout: 5000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, "01-phone-open-straight-in");

  await page.click("#menu-fab");
  await new Promise((r) => setTimeout(r, 250));
  const menu = await page.evaluate(() => {
    const lock = document.querySelector("#ov-lock");
    return {
      overflowOpen: document.querySelector("#overflow")?.classList.contains("open") ?? false,
      lockVisible: Boolean(lock) && !lock.hidden && lock.getClientRects().length > 0,
      items: [...document.querySelectorAll("#overflow button")].filter((b) => !b.hidden).map((b) => b.textContent.trim()),
    };
  });
  notes.push(menu);
  if (menu.lockVisible) throw new Error("Lock Slide is visible in the overflow menu");
  await shot(page, "02-phone-menu-no-lock");

  await page.click("#ov-profile");
  await page.waitForSelector(".profile-sheet:not([hidden])", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 400));
  const profile = await page.evaluate(() => {
    const sheet = document.querySelector(".profile-sheet");
    const text = sheet?.innerText ?? "";
    return {
      name: document.querySelector("#pf-name")?.textContent ?? "",
      since: document.querySelector(".pf-since")?.textContent ?? "",
      hasSignOut: Boolean(sheet?.querySelector("[data-signout]")),
      hasLock: Boolean(sheet?.querySelector("[data-lock]")),
      mentionsTest: /test driver|@slide_test/i.test(text),
    };
  });
  notes.push(profile);
  if (profile.hasSignOut) throw new Error("Profile still has Sign out");
  if (profile.hasLock) throw new Error("Profile still has Lock Slide");
  if (!/Test Driver/i.test(profile.name)) throw new Error(`Expected Test Driver, got ${profile.name}`);
  await shot(page, "03-phone-profile-test-driver");

  fs.writeFileSync(path.join(outDir, "verify.json"), JSON.stringify({ ok: true, notes }, null, 2));
  console.log("verify ok", JSON.stringify(notes, null, 2));
} finally {
  await browser.close();
}
