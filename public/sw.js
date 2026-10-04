// Slide service worker: makes the app installable and lets the shell open
// with a weak signal. It never caches routes, search, weather or map tiles —
// those always come live (or fail visibly), so nothing stale is shown as current.
// The one exception is the map *style* (style JSON, TileJSON, sprite, glyphs):
// it describes how the map looks, not what's on the road, so it's served from
// cache at once and refreshed in the background (stale-while-revalidate).
const CACHE = "slide-shell-v2";
const MAP_CACHE = "slide-mapstyle-v1";
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const TILES = "https://tiles.openfreemap.org";
const MAP_STYLE = [`${TILES}/styles/dark`, `${TILES}/planet`];

/** Style pieces only: never vector tiles (/planet/<version>/z/x/y.pbf) or raster tiles. */
function isMapStyle(url) {
  if (url.origin !== TILES) return false;
  return url.pathname === "/planet" || /^\/(styles|sprites|fonts)\//.test(url.pathname);
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
      // Best effort: a failed style pre-cache must never block the install.
      .then(() => caches.open(MAP_CACHE).then((c) => c.addAll(MAP_STYLE)).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MAP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (isMapStyle(url)) {
    e.respondWith(
      caches.open(MAP_CACHE).then((c) =>
        c.match(req.url).then((hit) => {
          const fresh = fetch(req).then((res) => {
            if (res.ok) c.put(req.url, res.clone());
            return res;
          });
          if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
          return fresh;
        })
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return; // tiles, Valhalla, Photon, fonts: straight to network

  if (req.mode === "navigate") {
    // Network first so a new deploy shows up immediately; cached shell only when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  if (url.pathname.includes("/assets/")) {
    // Hashed build files never change under the same name: cache first.
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
