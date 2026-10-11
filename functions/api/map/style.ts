/**
 * GET /api/map/style?look=night|ember|sand
 * TomTom Map Display vector style, key rewritten onto /api/map/tt/*.
 * Missing key or a failed upstream fetch → 204 so the client keeps OpenFreeMap.
 * Map tiles are billed separately from Search/Routing — not counted here.
 */
import { rewriteTomTomStyle, tomtomStyleUrl } from "../../../src/lib/tomtom-map";
import type { Look } from "../../../src/lib/garage";
import { LOOKS } from "../../../src/lib/garage";

type Env = { TOMTOM_API_KEY?: string };
type Ctx = { request: Request; env: Env };

const UA = "Slide/1 (+https://kings-slide.pages.dev)";
const LOOK: Record<string, Look> = Object.fromEntries(LOOKS.map((l) => [l, l]));

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const key = env.TOMTOM_API_KEY?.trim();
  if (!key) return new Response(null, { status: 204 });
  const look = LOOK[new URL(request.url).searchParams.get("look") ?? ""] ?? "night";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const up = await fetch(tomtomStyleUrl(key, look), {
      headers: { accept: "application/json", "user-agent": UA },
      signal: ctrl.signal,
    });
    if (!up.ok) return new Response(null, { status: 204 });
    const json: unknown = await up.json();
    if (!json || typeof json !== "object" || !("sources" in (json as object))) {
      return new Response(null, { status: 204 });
    }
    const style = rewriteTomTomStyle(json);
    return new Response(JSON.stringify(style), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
    });
  } catch {
    return new Response(null, { status: 204 });
  } finally {
    clearTimeout(t);
  }
}
