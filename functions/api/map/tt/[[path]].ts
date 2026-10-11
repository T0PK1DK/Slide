/**
 * GET /api/map/tt/* — key-adding proxy for TomTom Map Display assets
 * (vector tiles, glyphs, sprites). Only map/style paths; the secret stays
 * on the Function. Missing key → 204. Tiles are billed separately; we do
 * not spend the Search/Routing daily counter here.
 */
import { tomtomProxyPath } from "../../../../src/lib/tomtom-map";

type Env = { TOMTOM_API_KEY?: string };
type Ctx = { request: Request; env: Env; params?: { path?: string | string[] } };

const UA = "Slide/1 (+https://kings-slide.pages.dev)";

function rest(request: Request, params?: { path?: string | string[] }): string[] {
  if (params?.path) return (Array.isArray(params.path) ? params.path : params.path.split("/")).filter(Boolean);
  return new URL(request.url).pathname.replace(/^\/api\/map\/tt\/?/, "").split("/").filter(Boolean);
}

export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const key = env.TOMTOM_API_KEY?.trim();
  if (!key) return new Response(null, { status: 204 });
  const path = tomtomProxyPath(rest(request, params));
  if (!path) return new Response(null, { status: 404 });
  const incoming = new URL(request.url);
  const up = new URL(`https://api.tomtom.com/${path}`);
  incoming.searchParams.forEach((v, k) => { if (k !== "key") up.searchParams.set(k, v); });
  up.searchParams.set("key", key);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(up.toString(), { headers: { accept: "*/*", "user-agent": UA }, signal: ctrl.signal });
    if (!res.ok) return new Response(null, { status: 204 });
    return new Response(res.body, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") || "application/octet-stream",
        "cache-control": res.headers.get("cache-control") || "public, max-age=3600",
      },
    });
  } catch {
    return new Response(null, { status: 204 });
  } finally {
    clearTimeout(t);
  }
}
