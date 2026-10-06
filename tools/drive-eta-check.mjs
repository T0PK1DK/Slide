/**
 * Drive the real app in headless Chrome at 390 px on simulated GPS and watch
 * the ETA. Plans a real route (Valhalla + TomTom via /api/traffic/route),
 * presses Go, moves the GPS along the selected line at the route's own
 * average pace, and samples #drive-eta / #drive-remain once a second.
 *
 * Usage:
 *   node tools/drive-eta-check.mjs <baseUrl> <screenshot.png> [seconds=120]
 * Env:
 *   CHROME            Chrome binary (default /usr/bin/google-chrome)
 *   SLIDE_MOCK_ACCOUNT=1  Production bundles require a Slide account. In this
 *                     test browser only, every request to the Supabase host is
 *                     answered locally with a stand-in signed-in QA user (its
 *                     websocket is blocked), so the drive can run without
 *                     creating a real account. Nothing reaches Supabase;
 *                     routing (Valhalla) and traffic (/api/traffic/*) stay live.
 *   FROM / TO         Override the start fix "lat,lon" and destination text.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.argv[2] || "https://kings-slide.pages.dev/";
const shotFile = path.resolve(process.argv[3] || "route-brain.png");
const seconds = Number(process.argv[4] || 120);
// 1020 NW 6th Ave, Fort Lauderdale (US Census geocoder) → Galleria, E Sunrise Blvd (~3 mi).
const [fromLat, fromLon] = (process.env.FROM || "26.13713,-80.14993").split(",").map(Number);
const toText = process.env.TO || "2414 E Sunrise Blvd, Fort Lauderdale, FL";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode6(str) {
  let i = 0, lat = 0, lon = 0;
  const out = [];
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, result = 0;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lon += d;
    }
    out.push([lon / 1e6, lat / 1e6]);
  }
  return out;
}
const R = 6371008.8;
function meters(a, b) {
  const toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLon = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function pointAt(coords, cum, m) {
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] >= m) {
      const t = (m - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
      return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
    }
  }
  return coords[coords.length - 1];
}

const PROFILE = { name: "Route check", tag: "QA", pinHash: null, createdAt: Date.now() - 86400000, lastSeen: Date.now(), car: { make: "", model: "", year: null, fuel: "gas", sunpass: false } };

let supabaseHost = "";
if (process.env.SLIDE_MOCK_ACCOUNT === "1") {
  const env = fs.readFileSync(new URL("../.env.production", import.meta.url), "utf8");
  supabaseHost = new URL((env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1] || "").trim()).host;
}
const QA_UID = "00000000-0000-4000-8000-00000000qa01".replace("qa01", "0a01");
const QA_USER = { id: QA_UID, aud: "authenticated", role: "authenticated", email: "routecheck@users.slide.local", user_metadata: { username: "routecheck" }, app_metadata: { provider: "email" }, created_at: "2026-10-06T00:00:00Z" };
function b64url(o) { return Buffer.from(JSON.stringify(o)).toString("base64url"); }
const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const QA_SESSION = {
  access_token: `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: QA_UID, exp, role: "authenticated", aud: "authenticated" })}.local-test-only`,
  refresh_token: "local-test-only", token_type: "bearer", expires_in: 6 * 3600, expires_at: exp, user: QA_USER,
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const result = { baseUrl, toText, samples: [], trafficRouteCalls: 0, valhallaCalls: 0 };
try {
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(new URL(baseUrl).origin, ["geolocation"]);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
  await page.evaluateOnNewDocument((profile, session, uid) => {
    const sfx = session ? `.${uid}` : "";
    if (session) localStorage.setItem("slide.auth.v1", JSON.stringify(session));
    localStorage.setItem(`slide.profile.v1${sfx}`, JSON.stringify(profile));
    localStorage.setItem(`slide.session.v1${sfx}`, "on");
    for (const k of ["slide.garage.v1", `slide.garage.v1${sfx}`]) {
      const g = JSON.parse(localStorage.getItem(k) || "{}");
      localStorage.setItem(k, JSON.stringify({ ...g, coachDismissed: true, showTraffic: true }));
    }
  }, PROFILE, supabaseHost ? QA_SESSION : null, QA_UID);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  const trips = [];
  if (supabaseHost) {
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs", { urls: [`wss://${supabaseHost}/*`, `ws://${supabaseHost}/*`] });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const u = new URL(req.url());
      if (u.host !== supabaseHost) return req.continue();
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: cors });
      let body = "[]";
      if (u.pathname.startsWith("/auth/v1/user")) body = JSON.stringify(QA_USER);
      else if (u.pathname.startsWith("/auth/v1/token")) body = JSON.stringify(QA_SESSION);
      else if (u.pathname.startsWith("/auth/")) body = "{}";
      else if (u.pathname.startsWith("/rest/v1/rpc/")) body = "null";
      req.respond({ status: 200, contentType: "application/json", headers: cors, body });
    });
    result.supabaseMocked = true;
  }
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("/api/traffic/route")) result.trafficRouteCalls++;
    if (/valhalla.*\/route/.test(u)) {
      result.valhallaCalls++;
      try {
        const j = await res.json();
        for (const t of [j.trip, ...(j.alternates || []).map((a) => a.trip)].filter(Boolean)) trips.push(t);
      } catch { /* not json */ }
    }
  });
  await page.setGeolocation({ latitude: fromLat, longitude: fromLon, accuracy: 8 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#to", { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector(".login"), { timeout: 20000 });
  result.versionStamp = await page.$eval("#g-build-stamp", (e) => e.textContent).catch(() => null);
  // Plan: GPS start → typed destination → Drop the line.
  await sleep(2500);
  await page.evaluate(() => document.querySelector("#search-card")?.classList.add("open"));
  await page.click("#to", { clickCount: 3 }).catch(() => {});
  await page.type("#to", toText, { delay: 15 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.dataset.mode === "review", { timeout: 60000 });
  // Let the first TomTom answer land.
  await page.waitForFunction(() => document.querySelector("#review-eta")?.dataset.source !== undefined, { timeout: 20000 }).catch(() => {});
  await sleep(6000);
  result.review = await page.evaluate(() => ({
    eta: document.querySelector("#review-eta")?.textContent,
    dist: document.querySelector("#review-dist")?.textContent,
    note: document.querySelector("#review-eta-note")?.textContent,
    source: document.querySelector("#review-eta")?.dataset.source,
    live: document.querySelector("#review-eta")?.dataset.live,
    arrive: document.querySelector("#stat-eta")?.textContent,
  }));
  // The selected line = the Valhalla trip whose miles match the review sheet.
  const wantMi = parseFloat(result.review.dist || "0");
  const pick = trips
    .map((t) => ({ t, mi: t.summary?.length ?? 0 }))
    .sort((a, b) => Math.abs(a.mi - wantMi) - Math.abs(b.mi - wantMi))[0]?.t;
  if (!pick) throw new Error("No Valhalla trip captured");
  const coords = pick.legs.flatMap((l, i) => decode6(l.shape).slice(i ? 1 : 0));
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + meters(coords[i - 1], coords[i]));
  const total = cum[cum.length - 1];
  const paceMps = total / Math.max(60, pick.summary.time); // drive at the route's own average speed
  result.route = { miles: +(total / 1609.344).toFixed(2), valhallaMin: +(pick.summary.time / 60).toFixed(1), paceMph: +(paceMps * 2.23694).toFixed(1) };

  await page.click("#review-go");
  await page.waitForFunction(() => document.body.dataset.mode === "drive", { timeout: 15000 });
  const t0 = Date.now();
  let along = 0;
  for (let s = 0; s <= seconds; s++) {
    const [lon, lat] = pointAt(coords, cum, Math.min(along, total - 5));
    await page.setGeolocation({ latitude: lat, longitude: lon, accuracy: 6 });
    along += paceMps;
    await sleep(Math.max(0, t0 + (s + 1) * 1000 - Date.now()));
    const row = await page.evaluate(() => ({
      eta: document.querySelector("#drive-eta")?.textContent,
      remain: document.querySelector("#drive-remain")?.textContent,
      source: document.querySelector("#drive-eta")?.dataset.source,
      live: document.querySelector("#drive-eta")?.dataset.live,
      mode: document.body.dataset.mode,
    }));
    result.samples.push({ t: s, ...row });
    if (row.mode !== "drive") break;
  }
  await page.screenshot({ path: shotFile });
  result.screenshot = shotFile;
  result.errors = errors;

  // Verdict: minutes only count down (never back up), arrival clock steady, one source.
  const mins = result.samples.map((r) => parseInt(r.eta || "", 10)).filter(Number.isFinite);
  let ups = 0, changes = 0;
  for (let i = 1; i < mins.length; i++) { if (mins[i] > mins[i - 1]) ups++; if (mins[i] !== mins[i - 1]) changes++; }
  const arrivals = result.samples.map((r) => (r.remain || "").split(" · ")[1]).filter(Boolean);
  const sources = [...new Set(result.samples.map((r) => r.source))];
  result.verdict = {
    etaSequence: [...new Set(result.samples.map((r) => r.eta))],
    etaIncreases: ups,
    etaChanges: changes,
    arrivalClocks: [...new Set(arrivals)],
    sources,
    steady: ups === 0 && new Set(arrivals).size <= 2 && sources.length === 1,
  };
} finally {
  await browser.close();
}
const { samples, ...summary } = result;
console.log(JSON.stringify({ ...summary, sampleCount: samples.length, first: samples[0], last: samples[samples.length - 1] }, null, 2));
fs.writeFileSync(shotFile.replace(/\.png$/, ".json"), JSON.stringify(result, null, 2));
