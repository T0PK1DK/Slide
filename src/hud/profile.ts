import { clearTrips, lifetime, loadTrips } from "../lib/history";
import { eraseDeviceData, FUELS, loadProfile, saveProfile, toCar, type DriverProfile } from "../lib/profile";
import type { SavedPlace } from "../lib/garage";
import { lockApp } from "./login";
import { renderSocial } from "./social";

/**
 * Profile: who's driving, what they drive, and their own numbers. Everything on
 * this sheet lives on the phone, except the optional Slide account section
 * (src/hud/social.ts): handle, name, car tag and an opt-in car label.
 */
export type ProfileHooks = {
  places: () => { home: SavedPlace | null; work: SavedPlace | null };
  clearPlace: (which: "home" | "work") => void;
  openGarage: () => void;
  /** Called after the name or tag changes, so the rest of the app can repaint. */
  onChange: (p: DriverProfile) => void;
  /** Called after the drive history is cleared. */
  onHistoryCleared: () => void;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FUEL_LABEL: Record<(typeof FUELS)[number], string> = { gas: "Gas", hybrid: "Hybrid", electric: "Electric", diesel: "Diesel" };

export function mountProfile(h: ProfileHooks): { open(): void; close(): void } {
  const el = document.createElement("div");
  el.className = "profile-sheet";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "pf-name");
  el.hidden = true;
  document.body.appendChild(el);
  let opener: HTMLElement | null = null;

  const close = () => {
    el.hidden = true;
    opener?.focus();
  };

  const render = () => {
    const p = loadProfile();
    if (!p) return close();
    const life = lifetime(loadTrips());
    const since = new Date(p.createdAt).toLocaleDateString([], { month: "long", year: "numeric" });
    const car = p.car;
    const { home, work } = h.places();
    const place = (label: string, key: "home" | "work", v: SavedPlace | null) =>
      `<li><span class="pf-k">${label}</span><span class="pf-v">${v ? esc(v.label) : "Not set — save it from a search"}</span>${v ? `<button type="button" class="pf-x" data-clear="${key}" aria-label="Clear ${label}">Clear</button>` : ""}</li>`;
    el.innerHTML = `
      <div class="pf-card">
        <header class="pf-head">
          <div class="pf-avatar" aria-hidden="true">${esc((p.name.trim()[0] ?? "S").toUpperCase())}</div>
          <div class="pf-id">
            <h2 id="pf-name">${esc(p.name)}</h2>
            <span class="pf-tag">${esc(p.tag)}</span>
            <span class="pf-since">Driving with Slide since ${since}</span>
          </div>
          <button type="button" class="pf-close" aria-label="Close profile">×</button>
        </header>

        <section class="pf-stats" aria-label="Your driving, all time">
          <div><b>${life.drives}</b><span>Drives</span></div>
          <div><b>${life.miles.toFixed(0)}</b><span>Miles</span></div>
          <div><b>${life.smoothAvg === null ? "—" : life.smoothAvg.toFixed(0)}</b><span>Avg smooth</span></div>
        </section>

        <form class="pf-section pf-form" id="pf-driver">
          <h3>Driver</h3>
          <label>Name<input name="name" maxlength="24" required value="${esc(p.name)}" autocomplete="nickname" /></label>
          <label>Car tag<input name="tag" maxlength="10" value="${esc(p.tag)}" autocapitalize="characters" /></label>
          <button type="submit" class="pf-save">Save</button>
        </form>

        <form class="pf-section pf-form" id="pf-car">
          <h3>My car</h3>
          <div class="pf-row">
            <label>Make<input name="make" maxlength="24" value="${esc(car?.make ?? "")}" placeholder="Toyota" /></label>
            <label>Model<input name="model" maxlength="24" value="${esc(car?.model ?? "")}" placeholder="Camry" /></label>
          </div>
          <div class="pf-row">
            <label>Year<input name="year" inputmode="numeric" maxlength="4" value="${car?.year ?? ""}" placeholder="2021" /></label>
            <label>Fuel<select name="fuel">${FUELS.map((f) => `<option value="${f}"${car?.fuel === f ? " selected" : ""}>${FUEL_LABEL[f]}</option>`).join("")}</select></label>
          </div>
          <label class="pf-check"><input type="checkbox" name="sunpass"${car?.sunpass ? " checked" : ""} /> I have SunPass</label>
          <div class="pf-actions">
            <button type="submit" class="pf-save">Save car</button>
            <button type="button" class="pf-link" data-garage>Paint & camera in Garage</button>
          </div>
          <p class="pf-note">Stays on this phone. Slide never asks for your plate or VIN.</p>
        </form>

        <section class="pf-section" id="pf-social"></section>

        <section class="pf-section">
          <h3>Places</h3>
          <ul class="pf-list">${place("Home", "home", home)}${place("Work", "work", work)}</ul>
        </section>

        <section class="pf-section">
          <h3>Privacy</h3>
          <p class="pf-note">Your drives, places and car are saved only on this phone.</p>
          <div class="pf-actions wrap">
            <button type="button" class="pf-link" data-lock>Lock Slide</button>
            <button type="button" class="pf-danger" data-clear-history>Clear my drive history</button>
            <button type="button" class="pf-danger" data-erase>Erase everything on this phone</button>
          </div>
        </section>
      </div>`;

    el.querySelector(".pf-close")!.addEventListener("click", close);
    renderSocial(el.querySelector<HTMLElement>("#pf-social")!, p);
    el.querySelector<HTMLFormElement>("#pf-driver")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = new FormData(e.target as HTMLFormElement);
      const name = String(d.get("name") ?? "").trim();
      if (!name) return;
      const next = { ...p, name: name.slice(0, 24), tag: String(d.get("tag") ?? "").trim().toUpperCase().slice(0, 10) || p.tag };
      saveProfile(next);
      h.onChange(next);
      render();
    });
    el.querySelector<HTMLFormElement>("#pf-car")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = new FormData(e.target as HTMLFormElement);
      const next = {
        ...p,
        car: toCar({
          make: d.get("make"),
          model: d.get("model"),
          year: Number(d.get("year")) || null,
          fuel: d.get("fuel"),
          sunpass: d.get("sunpass") === "on",
        }),
      };
      saveProfile(next);
      h.onChange(next);
      render();
    });
    el.querySelector("[data-garage]")!.addEventListener("click", () => { close(); h.openGarage(); });
    el.querySelectorAll<HTMLButtonElement>("[data-clear]").forEach((b) =>
      b.addEventListener("click", () => { h.clearPlace(b.dataset.clear as "home" | "work"); render(); })
    );
    el.querySelector("[data-lock]")!.addEventListener("click", lockApp);
    el.querySelector("[data-clear-history]")!.addEventListener("click", () => {
      if (!confirm("Delete every recorded drive from this phone? This can't be undone.")) return;
      clearTrips();
      h.onHistoryCleared();
      render();
    });
    el.querySelector("[data-erase]")!.addEventListener("click", () => {
      if (!confirm(`Erase ${p.name}'s profile, car, places and drives from this phone?`)) return;
      eraseDeviceData();
      location.reload();
    });
  };

  el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  el.addEventListener("click", (e) => { if (e.target === el) close(); });

  return {
    open() {
      opener = document.activeElement as HTMLElement | null;
      render();
      el.hidden = false;
      el.querySelector<HTMLElement>(".pf-close")?.focus();
    },
    close,
  };
}
