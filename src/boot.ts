/**
 * First thing that runs. Paints the HUD and the login gate from a small chunk,
 * starts the map style downloads, then loads main.ts + MapLibre (~280 kB gzip)
 * in the background. On Slow 4G that puts the HUD up about 1.5 s sooner and lets
 * the style/sprite/glyphs download alongside the map engine instead of after it.
 */
import "./styles.css";
import { HUD_HTML } from "./hud/shell";
import { ensureSignedIn } from "./hud/login";
import { loadGarage, TRAILS } from "./lib/garage";
import type { DriverProfile } from "./lib/profile";
import { warmMapStyle } from "./map/warm";

export const STYLE = "https://tiles.openfreemap.org/styles/dark";

const g = loadGarage();
document.documentElement.dataset.look = g.look;
document.documentElement.style.setProperty("--glow", g.glow);
document.documentElement.style.setProperty("--mint", TRAILS[g.trail].line);
document.querySelector("#app")!.innerHTML = HUD_HTML;
document.body.dataset.mode = document.body.dataset.mode || "plan";

let signedIn: (p: DriverProfile) => void = () => {};
/** Resolves once the driver is past the login gate (immediately for a returning driver). */
export const driverReady = new Promise<DriverProfile>((resolve) => { signedIn = resolve; });
ensureSignedIn(document.body, (p) => signedIn(p));

/** Resolves when the MapLibre file has downloaded (its modulepreload link fired load). */
function mapEngineDownloaded(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="modulepreload"][href*="maplibre-"]');
  if (!link) return Promise.resolve(); // dev server: no preload link
  return new Promise((done) => {
    link.addEventListener("load", () => done(), { once: true });
    link.addEventListener("error", () => done(), { once: true });
    window.setTimeout(done, 8000);
  });
}
warmMapStyle(STYLE, mapEngineDownloaded());

/** Geist (display=swap) after the first full map render, or after 4 s, whichever comes first. */
function loadFonts() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600&family=Geist+Mono:wght@400;500&display=swap";
  document.head.appendChild(link);
}
{
  let done = false;
  const go = () => { if (!done) { done = true; watch.disconnect(); loadFonts(); } };
  const watch = new MutationObserver(() => { if (document.documentElement.dataset.map === "ready") go(); });
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-map"] });
  window.setTimeout(go, 4000);
}

// Installable app shell (Add to Home Screen). Production only, so dev reloads stay uncached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const register = () => { void navigator.serviceWorker.register("./sw.js").catch(() => {}); };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
void import("./main").catch(() => {
  // The app chunk failed to download (dropped connection mid-load). Say so instead of a dead HUD.
  const s = document.querySelector("#status");
  if (s) s.textContent = "Couldn't load the map. Check your signal and reload.";
});
