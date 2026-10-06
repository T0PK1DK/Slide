import { officialIncidents } from "../lib/reports";
import type { SavedPlace } from "../lib/garage";
import { requestRouteVariant, type LonLat } from "../lib/valhalla";
import type { Avoid } from "../lib/valhalla";
import { arrivalTarget, leaveByCopy } from "../plan/leaveby";

export type LeaveByHooks = {
  places: () => { home: SavedPlace | null; work: SavedPlace | null; recents: SavedPlace[] };
  origin: () => LonLat | null;
  avoid: () => Avoid;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function defaultTime(now = new Date()): string {
  const t = new Date(now.getTime() + 45 * 60 * 1000);
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

/**
 * Unstyled leave-by form. Grim owns the look. Uses a real Slide costing
 * duration + `leaveByForTarget` — never invents traffic delay.
 */
export function mountLeaveBy(el: HTMLElement, hooks: LeaveByHooks): { refresh(): void } {
  const paintPlaces = () => {
    const { home, work, recents } = hooks.places();
    const seen = new Set<string>();
    const opts: Array<{ label: string; place: SavedPlace }> = [];
    const add = (label: string, place: SavedPlace | null) => {
      if (!place) return;
      const id = `${place.lon.toFixed(5)},${place.lat.toFixed(5)}`;
      if (seen.has(id)) return;
      seen.add(id);
      opts.push({ label, place });
    };
    add("Home", home);
    add("Work", work);
    for (const r of recents) add(r.label, r);
    const box = el.querySelector("#lb-places")!;
    if (!opts.length) {
      box.innerHTML = "<p>Save Home, Work, or a recent place to use Leave by.</p>";
      return;
    }
    box.innerHTML = opts
      .map(
        (o, i) =>
          `<label><input type="radio" name="lb-place" value="${i}" data-lon="${o.place.lon}" data-lat="${o.place.lat}" data-label="${esc(o.place.label)}" ${i === 0 ? "checked" : ""} /> ${esc(o.label)}</label>`
      )
      .join("");
  };

  el.innerHTML = `
    <form id="lb-form">
      <p>Leave by</p>
      <div id="lb-places"></div>
      <label>Arrive at <input id="lb-time" type="time" required /></label>
      <button class="primary" type="submit">When should I leave?</button>
      <p id="lb-out" role="status" hidden></p>
    </form>`;
  const time = el.querySelector<HTMLInputElement>("#lb-time")!;
  time.value = defaultTime();
  paintPlaces();

  el.querySelector("#lb-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = el.querySelector<HTMLElement>("#lb-out")!;
    const origin = hooks.origin();
    const picked = el.querySelector<HTMLInputElement>("input[name=lb-place]:checked");
    const target = arrivalTarget(time.value);
    if (!origin) {
      out.hidden = false;
      out.textContent = "Locate first so the time is from where you are.";
      return;
    }
    if (!picked?.dataset.lon || !picked.dataset.lat || !target) {
      out.hidden = false;
      out.textContent = "Pick a saved place and an arrival time.";
      return;
    }
    const dest: LonLat = { lon: Number(picked.dataset.lon), lat: Number(picked.dataset.lat) };
    out.hidden = false;
    out.textContent = `Checking the typical time to ${picked.dataset.label ?? "that place"}…`;
    try {
      const res = await requestRouteVariant([origin, dest], "slide", hooks.avoid());
      const durationSec = res.trip?.summary?.time;
      if (typeof durationSec !== "number") {
        out.textContent = "No typical time for that trip.";
        return;
      }
      const incidents = await officialIncidents(origin.lat, origin.lon, 8).catch(() => []);
      const copy = leaveByCopy(durationSec, target, new Date(), incidents.length > 0 ? incidents.length : null);
      out.innerHTML = `<strong>${esc(copy.headline)}</strong><span> ${esc(copy.note)}</span>`;
    } catch {
      out.textContent = "Couldn't reach routing for that trip.";
    }
  });

  return { refresh: paintPlaces };
}
