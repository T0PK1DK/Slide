import maplibregl from "maplibre-gl";
import type { Fix } from "../lib/tracking";
import { cloudConfigured } from "../lib/cloud";
import { friendsPresence, sharePresence, stopPresence, type FriendSpot } from "../lib/presence";
import { currentUserId } from "../lib/social";
import { ago } from "../lib/reports";

/**
 * Friends on the map: a soft ~1 km circle (positions are rough on purpose) with
 * a name chip. Shown while planning or reviewing; hidden entirely while
 * driving so nothing tempts a glance. When the driver shares, a pill says so
 * and stops it in one tap.
 */
export type FriendsHooks = {
  map: maplibregl.Map;
  getFix: () => Fix | null;
  sharing: () => boolean;
  setSharing: (on: boolean) => void;
};
export type FriendsView = { setMode(mode: string): void; refresh(): void };

const SHARE_EVERY_MS = 60_000;
const READ_EVERY_MS = 45_000;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function mountFriends(h: FriendsHooks): FriendsView {
  let markers: maplibregl.Marker[] = [];
  let spots: FriendSpot[] = [];
  let mode = "plan";
  let lastShare = 0, lastRead = 0;
  let busy = false;

  const pill = document.createElement("div");
  pill.className = "share-pill";
  pill.hidden = true;
  pill.innerHTML = `<i aria-hidden="true"></i><span>Sharing rough location with friends</span><button type="button">Stop</button>`;
  document.body.appendChild(pill);
  pill.querySelector("button")!.addEventListener("click", async () => {
    h.setSharing(false);
    pill.hidden = true;
    await stopPresence().catch(() => undefined);
  });

  const hideAll = () => { markers.forEach((m) => m.remove()); markers = []; };

  const draw = () => {
    hideAll();
    if (mode === "drive" || mode === "arrive") return;
    for (const f of spots) {
      const el = document.createElement("div");
      el.className = "friend-spot";
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", `${f.name}, around here, ${ago(f.updatedAt)}`);
      el.innerHTML = `<span class="fs-area"></span><span class="fs-chip"><b>${esc((f.name[0] ?? "?").toUpperCase())}</b>${esc(f.name)}<small>${ago(f.updatedAt)}</small></span>`;
      markers.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([f.lon, f.lat]).addTo(h.map));
    }
    sizeAreas();
  };

  // The circle is ~1 km across on the ground, so it grows and shrinks with zoom.
  const sizeAreas = () => {
    const fix = h.getFix();
    const lat = fix?.pos.lat ?? 25.8;
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** h.map.getZoom();
    const px = Math.max(24, Math.min(400, 1100 / mpp));
    for (const m of markers) {
      const a = m.getElement().querySelector<HTMLElement>(".fs-area");
      if (a) a.style.width = a.style.height = `${px}px`;
    }
  };
  h.map.on("zoom", sizeAreas);

  const tick = async () => {
    if (busy || document.hidden || !cloudConfigured()) return;
    busy = true;
    try {
      if (!(await currentUserId())) { spots = []; pill.hidden = true; draw(); return; }
      const fix = h.getFix();
      const sharing = h.sharing();
      pill.hidden = !sharing || mode === "drive";
      if (sharing && fix && Date.now() - lastShare > SHARE_EVERY_MS) {
        lastShare = Date.now();
        await sharePresence(fix.pos.lat, fix.pos.lon).catch(() => undefined);
      }
      if (Date.now() - lastRead > READ_EVERY_MS) {
        lastRead = Date.now();
        spots = await friendsPresence().catch(() => spots);
        draw();
      }
    } finally {
      busy = false;
    }
  };
  window.setInterval(() => void tick(), 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void tick(); });

  return {
    setMode(m) {
      mode = m;
      pill.hidden = pill.hidden || m === "drive";
      draw();
    },
    refresh() {
      lastShare = 0;
      lastRead = 0;
      void tick();
    },
  };
}
