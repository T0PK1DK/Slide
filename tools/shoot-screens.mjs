/**
 * Capture Slide HUD screens at phone (390) and desktop (1440).
 * Usage: node tools/shoot-screens.mjs <outDir> [baseUrl]
 * Seeds an on-device test driver so returning-driver screens are reachable.
 * Empty/default chrome only — no invented trips, traffic, or reports.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve(process.argv[2] || "artifacts/screens");
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

async function seed(page, { look = "night", coach = false } = {}) {
  await page.evaluateOnNewDocument(
    (profile, garage, look, coach) => {
      localStorage.setItem("slide.profile.v1", JSON.stringify(profile));
      localStorage.setItem("slide.session.v1", "on");
      localStorage.setItem("slide.garage.v1", JSON.stringify({ ...garage, look, coachDismissed: !coach }));
    },
    PROFILE,
    GARAGE,
    look,
    coach,
  );
}

async function ready(page) {
  await page.waitForSelector("#search-card, .login-card", { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".boot"), { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

async function show(page, fn) {
  await page.evaluate(fn);
  await new Promise((r) => setTimeout(r, 250));
}

async function withViewport(browser, width, height, label, walk) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: width < 800, hasTouch: width < 800 });
  await walk(page, label);
  await page.close();
}

const chrome = process.env.CHROME || "/usr/bin/google-chrome-stable";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  // Login (first visit, no seed)
  for (const [w, h, tag] of [[390, 844, "phone"], [1440, 900, "desktop"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 800, hasTouch: w < 800 });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await ready(page);
    await shot(page, `01-login-${tag}`);
    await page.close();
  }

  const screens = async (page, tag) => {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await ready(page);
    await page.evaluate(() => {
      document.querySelector(".login")?.remove();
      document.body.dataset.mode = "plan";
    });
    if (tag === "desktop") {
      await page.waitForSelector("body.cmd .cmd-top", { timeout: 15000 }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 400));
    await shot(page, `02-plan-${tag}`);

    await show(page, () => {
      document.body.dataset.mode = "review";
      const r = document.getElementById("review-sheet");
      if (r) {
        r.hidden = false;
        document.getElementById("review-eta").textContent = "14 min";
        document.getElementById("review-dist").textContent = "6.2 mi";
        document.getElementById("review-via").textContent = "via Brickell Ave";
        document.getElementById("review-tag").textContent = "Slide pick · no tolls";
        const track = document.getElementById("route-track");
        if (track) {
          track.innerHTML = `
            <button type="button" class="route-card on" aria-pressed="true"><span class="route-card-tag">Slide pick</span><b>14 min</b><span class="route-card-mi">6.2 mi</span><span class="route-card-why">4 fewer lefts · smoothest line</span></button>
            <button type="button" class="route-card"><span class="route-card-tag">Fastest</span><b>12 min</b><span class="route-card-mi">6.4 mi</span><span class="route-card-why">More lefts · typical time</span></button>
            <button type="button" class="route-card"><span class="route-card-tag">No tolls</span><b>16 min</b><span class="route-card-mi">6.8 mi</span><span class="route-card-why">Avoids SunPass roads</span></button>`;
          const dots = document.getElementById("route-dots");
          if (dots) { dots.hidden = false; dots.innerHTML = `<i class="on"></i><i></i><i></i>`; }
        }
      }
    });
    await shot(page, `03-review-${tag}`);

    await show(page, () => {
      document.getElementById("route-options")?.removeAttribute("hidden");
    });
    await shot(page, `04-options-${tag}`);

    await show(page, () => {
      document.getElementById("route-options")?.setAttribute("hidden", "");
      document.body.dataset.mode = "drive";
      const man = document.getElementById("maneuver");
      if (man) {
        man.hidden = false;
        document.getElementById("man-dist").textContent = "0.4 mi";
        document.getElementById("man-instr").textContent = "Turn right onto Biscayne Blvd";
      }
      const posted = document.getElementById("posted");
      if (posted) { posted.hidden = false; posted.textContent = "Hold 35 → 25 in 0.3 mi"; }
      const speedo = document.getElementById("speedo");
      if (speedo) {
        speedo.hidden = false;
        document.getElementById("speed-n").textContent = "28";
        document.getElementById("speed-src").textContent = "MPH";
        const lim = document.getElementById("limit");
        if (lim) { lim.hidden = false; document.getElementById("limit-n").textContent = "35"; }
      }
      const bar = document.getElementById("drive-bar");
      if (bar) {
        bar.hidden = false;
        document.getElementById("drive-eta").textContent = "12 min";
        document.getElementById("drive-remain").textContent = "4.1 mi · Brickell";
      }
      const mute = document.getElementById("drive-mute");
      if (mute) mute.hidden = false;
      const report = document.getElementById("drive-report");
      if (report) report.hidden = false;
    });
    await shot(page, `05-drive-${tag}`);

    await show(page, () => {
      document.body.dataset.mode = "arrive";
      const a = document.getElementById("arrival");
      if (a) {
        a.hidden = false;
        document.getElementById("arr-kicker").textContent = "ARRIVED · 4:12 PM";
        document.getElementById("arr-dest").textContent = "Bayside Marketplace";
        document.getElementById("arr-time").textContent = "14 min";
        document.getElementById("arr-dist").textContent = "6.2 mi";
        document.getElementById("arr-line").textContent = "Slide";
        document.getElementById("arr-note").textContent = "Typical time · no live traffic yet";
      }
    });
    await shot(page, `06-arrival-${tag}`);

    await show(page, () => {
      document.getElementById("arrival")?.setAttribute("hidden", "");
      document.body.dataset.mode = "plan";
      const p = document.getElementById("place-card");
      if (p) {
        p.hidden = false;
        const n = document.getElementById("place-name");
        const a = document.getElementById("place-addr");
        if (n) n.textContent = "Bayside Marketplace";
        if (a) a.textContent = "401 Biscayne Blvd, Miami";
      }
    });
    await shot(page, `14-place-${tag}`);

    await show(page, () => {
      document.getElementById("place-card")?.setAttribute("hidden", "");
      let rs = document.querySelector(".radar-sheet");
      if (!rs) {
        rs = document.createElement("div");
        rs.className = "radar-sheet";
        document.body.appendChild(rs);
      }
      rs.hidden = false;
      rs.innerHTML = `<div class="rs-card"><header><h2>What's on the road?</h2><button type="button" class="rs-close">×</button></header>
        <div class="rs-kinds">
          <button type="button" class="rs-kind"><span class="rs-ico police"></span><span>Police</span></button>
          <button type="button" class="rs-kind"><span class="rs-ico crash"></span><span>Crash</span></button>
          <button type="button" class="rs-kind"><span class="rs-ico hazard"></span><span>Hazard</span></button>
          <button type="button" class="rs-kind"><span class="rs-ico closure"></span><span>Closure</span></button>
          <button type="button" class="rs-kind"><span class="rs-ico jam"></span><span>Traffic jam</span></button>
        </div>
        <p class="rs-src">Reported at your current spot. Your name is never shown with a report.</p></div>`;
    });
    await shot(page, `15-report-${tag}`);

    await show(page, () => {
      const rs = document.querySelector(".radar-sheet");
      if (rs) {
        rs.hidden = false;
        rs.innerHTML = `<div class="rs-card"><header><h2>Hazard</h2><button type="button" class="rs-close">×</button></header>
          <div class="rs-hero"><span class="rs-ico hazard"></span></div>
          <p class="rs-src">Pick what you see, then Send.</p>
          <div class="rs-subs"><button type="button" class="rs-sub on">Object</button><button type="button" class="rs-sub">Shoulder</button><button type="button" class="rs-sub">Weather</button></div>
          <div class="rs-send"><button type="button" class="ghost">Later</button><button type="button" class="primary">Send</button></div></div>`;
      }
    });
    await shot(page, `16-report-sub-${tag}`);

    await show(page, () => {
      document.querySelector(".radar-sheet")?.setAttribute("hidden", "");
      const loc = document.getElementById("loc-banner");
      if (loc) {
        loc.hidden = false;
        loc.dataset.kind = "denied";
        const t = document.getElementById("loc-title");
        const m = document.getElementById("loc-msg");
        if (t) t.textContent = "Location is off";
        if (m) m.textContent = "Location is off for Slide. Allow it in your browser or phone settings, then tap Try again.";
      }
    });
    await shot(page, `17-location-denied-${tag}`);
    await show(page, () => {
      document.getElementById("loc-banner")?.setAttribute("hidden", "");
    });

    await show(page, () => {
      document.getElementById("arrival")?.setAttribute("hidden", "");
      document.body.dataset.mode = "plan";
      document.getElementById("garage")?.classList.add("open");
    });
    await shot(page, `07-garage-${tag}`);

    await show(page, () => {
      document.getElementById("garage")?.classList.remove("open");
      const coach = document.getElementById("coach");
      if (coach) coach.hidden = false;
    });
    await shot(page, `08-coach-${tag}`);

    await show(page, () => {
      document.getElementById("coach")?.setAttribute("hidden", "");
      let sheet = document.querySelector(".profile-sheet");
      if (!sheet) {
        sheet = document.createElement("div");
        sheet.className = "profile-sheet";
        sheet.innerHTML = `<div class="pf-card">
          <header class="pf-head">
            <div class="pf-avatar">K</div>
            <div class="pf-id"><h2 id="pf-name">King</h2><span class="pf-tag">SLIDE-01</span>
            <span class="pf-since">Driving with Slide since September 2026</span></div>
            <button type="button" class="pf-close" aria-label="Close">×</button>
          </header>
          <section class="pf-stats"><div><b>0</b><span>Drives</span></div>
            <div><b>0</b><span>Miles</span></div><div><b>After a drive</b><span>Avg smooth</span></div></section>
          <section class="pf-section"><h3>Driver</h3><p class="pf-note">Name, tag and My car stay on this phone.</p></section>
        </div>`;
        document.body.appendChild(sheet);
      }
      sheet.hidden = false;
    });
    await shot(page, `09-profile-${tag}`);

    await show(page, () => {
      document.querySelector(".profile-sheet")?.setAttribute("hidden", "");
      document.body.classList.add("cmd-sheet");
      let wrap = document.querySelector(".cmd-sheet-wrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "cmd-sheet-wrap";
        wrap.innerHTML = `<button type="button" class="cmd-sheet-close" aria-label="Close">×</button>
          <div class="cmd-rail">
            <section class="cmd-card"><header><h2>Drive overview</h2></header>
              <div class="cmd-kpis"><div><b>0</b><span><i class="dot ok"></i>Drives</span></div>
              <div><b>0</b><span><i class="dot warn"></i>Off-route</span></div>
              <div><b>0</b><span><i class="dot"></i>Miles</span></div></div></section>
            <section class="cmd-card"><header><h2 class="cmd-sub">Smooth score</h2></header>
              <div class="cmd-big">After a drive</div>
              <div class="cmd-empty">No drives yet. Plan a route and tap Go with location on — only real GPS drives are saved.</div>
            </section>
          </div>`;
        document.body.appendChild(wrap);
      }
    });
    await shot(page, `10-insights-${tag}`);

    await show(page, () => {
      document.body.classList.remove("cmd-sheet");
      document.querySelector(".cmd-sheet-wrap")?.remove();
      let rs = document.querySelector(".radar-sheet");
      if (!rs) {
        rs = document.createElement("div");
        rs.className = "radar-sheet";
        rs.innerHTML = `<div class="rs-card"><header><h2>Radar</h2><button type="button" class="rs-close">×</button></header>
          <p class="rs-src">Driver reports · official incidents from FDOT and Miami-Dade Police · cameras mapped in OpenStreetMap.</p>
          <ul class="rs-list"><li class="rs-empty">Nothing reported within 1.5 mi.</li></ul></div>`;
        document.body.appendChild(rs);
      }
      rs.hidden = false;
    });
    await shot(page, `11-radar-${tag}`);

    await show(page, () => {
      document.querySelector(".radar-sheet")?.setAttribute("hidden", "");
      let loc = document.getElementById("net-sheet");
      if (loc) {
        loc.hidden = false;
        loc.dataset.kind = "offline";
        const t = document.getElementById("net-title");
        const m = document.getElementById("net-msg");
        if (t) t.textContent = "You're offline";
        if (m) m.textContent = "Slide can't reach the route engine until you're back online.";
      }
    });
    await shot(page, `12-offline-${tag}`);

    await show(page, () => {
      const loc = document.getElementById("net-sheet");
      if (loc) {
        loc.hidden = false;
        loc.dataset.kind = "no-route";
        const t = document.getElementById("net-title");
        const m = document.getElementById("net-msg");
        if (t) t.textContent = "No drivable route found";
        if (m) m.textContent = "These points can't be joined by road. Try a nearby address, or remove a stop.";
      }
    });
    await shot(page, `18-no-route-${tag}`);
  };

  for (const [w, h, tag] of [[390, 844, "phone"], [1440, 900, "desktop"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 800, hasTouch: w < 800 });
    await seed(page);
    await screens(page, tag);
    await page.close();
  }

  // Theme variants on plan (phone + desktop)
  for (const look of ["ember", "sand"]) {
    for (const [w, h, tag] of [[390, 844, "phone"], [1440, 900, "desktop"]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 800, hasTouch: w < 800 });
      await seed(page, { look });
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await ready(page);
      await page.evaluate((look) => {
        document.querySelector(".login")?.remove();
        document.documentElement.dataset.look = look;
      }, look);
      await new Promise((r) => setTimeout(r, 200));
      await shot(page, `13-plan-${look}-${tag}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
