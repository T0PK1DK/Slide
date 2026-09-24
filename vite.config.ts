import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
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
