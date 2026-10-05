import { defineConfig, type Plugin } from "vite";

/**
 * boot.ts loads main.ts (and MapLibre) with a dynamic import so the HUD paints
 * first. Vite only starts those downloads when boot runs, so tell the browser
 * about them in the HTML: they download in parallel with boot instead of after it.
 */
function preloadApp(): Plugin {
  return {
    name: "slide-preload-app",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const chunks = Object.values(ctx.bundle ?? {}).filter((c) => c.type === "chunk");
        const main = chunks.find((c) => c.type === "chunk" && c.facadeModuleId?.endsWith("/src/main.ts"));
        if (!main || main.type !== "chunk") return [];
        const entries = new Set(chunks.filter((c) => c.type === "chunk" && c.isEntry).map((c) => c.fileName));
        const files = [main.fileName, ...main.imports].filter((f, i, a) => a.indexOf(f) === i && !entries.has(f));
        return files.map((f) => ({ tag: "link", attrs: { rel: "modulepreload", crossorigin: true, href: `./${f}` }, injectTo: "head" as const }));
      },
    },
  };
}

/** Local `/api/geocode` so `npm run dev` hits Nominatim + Census the same way Pages does. */
function geocodeDev(): Plugin {
  return {
    name: "slide-geocode-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url ?? "";
        const path = raw.split("?")[0];
        if (path !== "/api/geocode") return next();
        try {
          const { fallbackPlaces, GEOCODE_UA } = await import("./src/lib/geocode.ts");
          const url = new URL(raw, "http://localhost");
          const q = url.searchParams.get("q") ?? "";
          const lat = Number(url.searchParams.get("lat"));
          const lon = Number(url.searchParams.get("lon"));
          const intent = url.searchParams.get("intent") === "resolve" ? "resolve" as const : "suggest" as const;
          const bias = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined;
          const hits = await fallbackPlaces(q, bias, intent, { proxy: "", userAgent: GEOCODE_UA });
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ hits }));
        } catch (e) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ hits: [], error: e instanceof Error ? e.message : "geocode failed" }));
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  plugins: [preloadApp(), geocodeDev()],
  build: {
    // MapLibre is ~800 kB on its own; keep it in a separate long-cached chunk
    // so an app-only deploy doesn't make phones re-download the map engine.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("node_modules/maplibre-gl") ? "maplibre" : undefined),
      },
    },
  },
});
