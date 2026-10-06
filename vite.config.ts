import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Build stamp: short commit + build time. Shown in Garage and Profile so the
 * driver can see which version is on the phone, written to dist/version.json
 * (no-store) for the in-app update check, and baked into dist/sw.js so every
 * deploy is a byte-different service worker that the phone installs.
 */
function buildStamp() {
  let sha = (process.env.SLIDE_BUILD_SHA ?? "").trim().slice(0, 7);
  if (!sha) {
    try {
      sha = execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      sha = "local";
    }
  }
  return { sha, builtAt: new Date().toISOString() };
}
const BUILD = buildStamp();

function versionFiles(): Plugin {
  let outDir = "dist";
  return {
    name: "slide-version-files",
    apply: "build",
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    closeBundle() {
      writeFileSync(resolve(outDir, "version.json"), JSON.stringify(BUILD) + "\n");
      const sw = resolve(outDir, "sw.js");
      if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, "utf8").replaceAll("__SLIDE_BUILD__", `${BUILD.sha}-${BUILD.builtAt}`));
    },
  };
}

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

/** Local stand-in for functions/api/geocode.ts + /api/suggest so `npm run dev` hits the same chain. */
function geocodeApi(): Plugin {
  const handle = async (req: { url?: string }, res: { statusCode: number; setHeader(k: string, v: string): void; end(s: string): void }, next: () => void) => {
    const path = req.url?.split("?")[0] ?? "";
    if (path !== "/api/geocode" && path !== "/api/suggest") return next();
    const { handleGeocodeRequest } = await import("./src/lib/geocode");
    const key = process.env.TOMTOM_API_KEY?.trim();
    const { hits, error, attribution } = await handleGeocodeRequest(`https://localhost${req.url ?? "/api/geocode"}`, {
      tomtomKey: key,
      tomtom: Boolean(key),
    });
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ hits, ...(error ? { error } : {}), ...(attribution ? { attribution } : {}) }));
  };
  return {
    name: "slide-geocode-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => { void handle(req, res, next); });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => { void handle(req, res, next); });
    },
  };
}

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  define: { __SLIDE_BUILD__: JSON.stringify(BUILD) },
  plugins: [preloadApp(), geocodeApi(), versionFiles()],
  build: {
    // MapLibre is ~800 kB on its own; keep it in a separate long-cached chunk
    // so an app-only deploy doesn't make phones re-download the map engine.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/maplibre-gl")) return "maplibre";
          if (id.includes("node_modules/three")) return "three";
        },
      },
    },
  },
});
