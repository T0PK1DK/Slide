/**
 * GET /api/traffic/flow/:z/:x/:y — TomTom relative raster flow tile.
 * 204 when TOMTOM_API_KEY is missing so MapLibre just shows a blank overlay.
 */
import { flowTileUrl, TOMTOM_TILE_MAX_Z, TOMTOM_TILE_MIN_Z } from "../../../../src/lib/sources/tomtom";
import { cachedGet } from "../../../lib/cache";

type Env = { TOMTOM_API_KEY?: string };
type Ctx = {
  env: Env;
  params: { path?: string | string[] };
  waitUntil(p: Promise<unknown>): void;
};

export async function onRequestGet({ env, params, waitUntil }: Ctx): Promise<Response> {
  if (!env.TOMTOM_API_KEY) return new Response(null, { status: 204 });
  const parts = Array.isArray(params.path) ? params.path : String(params.path ?? "").split("/").filter(Boolean);
  const z = Number(parts[0]);
  const x = Number(parts[1]);
  const y = Number(String(parts[2] ?? "").replace(/\.png$/i, ""));
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return new Response(null, { status: 400 });
  }
  if (z < TOMTOM_TILE_MIN_Z || z > TOMTOM_TILE_MAX_Z) return new Response(null, { status: 204 });
  try {
    const up = await cachedGet(`tomtom-flow-tile/${z}/${x}/${y}`, flowTileUrl(z, x, y, env.TOMTOM_API_KEY), waitUntil, 90, 8000);
    return new Response(up.body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=90",
      },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}
