/**
 * Make new deploys reach the phone.
 *
 * iOS keeps a Home Screen web app (and a Safari tab) alive in memory: opening
 * it again just resumes the old page, so neither the new index.html nor the
 * service worker update check ever runs. Here the app asks the server which
 * build is live (`version.json`, no-store) on start, whenever it comes back to
 * the foreground, and every 10 min while open. When the build differs it
 * updates the service worker, then reloads by itself if nothing is in
 * progress (plan screen, or just resumed), or shows a "tap to update" pill
 * when a route or drive is on screen. It never reloads mid-drive.
 */

export type BuildStamp = { sha: string; builtAt: string };

export const BUILD: BuildStamp =
  typeof __SLIDE_BUILD__ !== "undefined" ? __SLIDE_BUILD__ : { sha: "dev", builtAt: "" };

/** "e5c5ff0 · Oct 6, 10:41 AM" for Settings / Profile. */
export function buildLabel(b: BuildStamp = BUILD, locale?: string): string {
  if (!b.builtAt) return b.sha;
  const d = new Date(b.builtAt);
  if (Number.isNaN(d.getTime())) return b.sha;
  const when = d.toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${b.sha} · ${when}`;
}

/** True when the server reports a different real build than the one running. */
export function isOtherBuild(remote: unknown, local: BuildStamp = BUILD): remote is BuildStamp {
  if (!remote || typeof remote !== "object") return false;
  const sha = (remote as { sha?: unknown }).sha;
  if (typeof sha !== "string" || !/^[0-9a-z]{4,12}$/i.test(sha)) return false;
  if (local.sha === "dev") return false;
  const builtAt = (remote as { builtAt?: unknown }).builtAt;
  return sha !== local.sha || (typeof builtAt === "string" && local.builtAt !== "" && builtAt !== local.builtAt);
}

/** Safe to reload without losing anything on screen. */
export function canReloadNow(mode: string | undefined, justResumed: boolean): boolean {
  if (mode === "drive" || mode === "arrive") return false;
  return mode === "plan" || mode === undefined || justResumed && mode !== "review";
}

const CHECK_EVERY_MS = 10 * 60_000;
const RELOADED_KEY = "slide.update.reloadedFor";

export function watchForUpdates(): void {
  if (typeof window === "undefined" || BUILD.sha === "dev") return;
  let reg: ServiceWorkerRegistration | null = null;
  let pending: BuildStamp | null = null;
  let busy = false;
  let pill: HTMLButtonElement | null = null;

  const register = () => {
    if (!("serviceWorker" in navigator)) return;
    // updateViaCache "none": the browser never answers the sw.js update check from its HTTP cache.
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((r) => { reg = r; }).catch(() => {});
  };

  const reload = (to: BuildStamp) => {
    try {
      if (sessionStorage.getItem(RELOADED_KEY) === to.sha) { showPill(); return; } // already tried once for this build
      sessionStorage.setItem(RELOADED_KEY, to.sha);
    } catch { /* private mode: still reload once */ }
    location.reload();
  };

  const showPill = () => {
    if (pill) { pill.hidden = false; return; }
    pill = document.createElement("button");
    pill.type = "button";
    pill.className = "update-pill";
    pill.textContent = "Slide updated · tap to load";
    pill.setAttribute("aria-live", "polite");
    pill.addEventListener("click", () => {
      try { sessionStorage.removeItem(RELOADED_KEY); } catch { /* ignore */ }
      location.reload();
    });
    document.body.appendChild(pill);
  };

  const check = async (justResumed: boolean) => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) return;
      const remote: unknown = await res.json();
      if (!isOtherBuild(remote)) return;
      pending = remote;
      await reg?.update().catch(() => {});
      if (canReloadNow(document.body.dataset.mode, justResumed)) reload(remote);
      else showPill();
    } catch {
      /* offline: try again later */
    } finally {
      busy = false;
    }
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
  window.setTimeout(() => { void check(false); }, 4000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void check(true); });
  window.addEventListener("pageshow", (e) => { if (e.persisted) void check(true); });
  window.setInterval(() => { void check(false); }, CHECK_EVERY_MS);
  // A drive ended with an update waiting: load it once the driver is back on the plan screen.
  new MutationObserver(() => {
    if (pending && document.body.dataset.mode === "plan") reload(pending);
  }).observe(document.body, { attributes: true, attributeFilter: ["data-mode"] });
}
