/**
 * GET /api/incidents?lat=&lon=&km= — official incidents near a point, merged
 * from free public feeds into one list of radar items:
 *   - fdot:  FDOT DIVAS events (crashes, disabled vehicles, congestion, roadwork), no key
 *   - mdpd:  Miami-Dade Police dispatched traffic calls, no key (no CORS → server side only)
 *   - fl511: Florida 511 events, only when the FL511_API_KEY secret is set
 *   - tomtom: Traffic Incident Details when TOMTOM_API_KEY is set (deduped vs FDOT/MDPD)
 * Each source is fetched with a short timeout and cached ~60 s at the edge, so
 * every driver shares one upstream call per minute. A source that fails is
 * reported in `sources` and simply left out; the others still answer.
 */
import { fromFl511, withinKm } from "../../src/lib/sources/fl511";
import { divasUrl, fromDivas } from "../../src/lib/sources/fdot";
import { fromMdpd, MDPD_URL } from "../../src/lib/sources/mdpd";
import { bboxAround, fromTomTom, TOMTOM_INCIDENTS } from "../../src/lib/sources/tomtom";
import { foldTomTomIntoOfficial } from "../../src/lib/incidents-merge";
import { INCIDENT_TTL_SEC, cacheBudgetStore, edgeCache, reserve } from "../../src/lib/tomtom-budget";
import type { RadarItem } from "../../src/lib/reports";

type Env = { FL511_API_KEY?: string; TOMTOM_API_KEY?: string };
type Ctx = { request: Request; env: Env; waitUntil(p: Promise<unknown>): void };
type SourceStatus = { source: string; ok: boolean; count: number; error?: string };

const FL511 = "https://fl511.com/api/v2/get/event";
const UA = "Slide/1 (+https://kings-slide.pages.dev)";
const json = (body: unknown, maxAge = 30) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

/** One upstream JSON fetch, shared through the edge cache for `ttl` seconds. */
async function cachedJson(name: string, url: string, waitUntil: Ctx["waitUntil"], ttl = 60, timeoutMs = 7000): Promise<unknown> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://slide-cache.invalid/incidents/${name}`);
  let res = await cache.match(key);
  if (!res) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const up = await fetch(url, { headers: { accept: "application/json", "user-agent": UA }, signal: ctrl.signal });
      if (!up.ok) throw new Error(`HTTP ${up.status}`);
      res = new Response(await up.text(), { headers: { "cache-control": `public, max-age=${ttl}` } });
      waitUntil(cache.put(key, res.clone()));
    } catch (e) {
      throw new Error(e instanceof Error && e.name === "AbortError" ? "timeout" : e instanceof Error ? e.message : "fetch failed");
    } finally {
      clearTimeout(t);
    }
  }
  return res.json();
}

async function source(name: string, load: () => Promise<RadarItem[]>): Promise<{ status: SourceStatus; items: RadarItem[] }> {
  try {
    const items = await load();
    return { status: { source: name, ok: true, count: items.length }, items };
  } catch (e) {
    return { status: { source: name, ok: false, count: 0, error: e instanceof Error ? e.message : "failed" }, items: [] };
  }
}

const notNull = <T,>(x: T | null): x is T => x !== null;

export async function onRequestGet({ request, env, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const km = Math.min(Math.max(Number(url.searchParams.get("km")) || 12, 1), 200);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "lat and lon required" }, 0);

  const jobs = [
    source("fdot", async () => {
      const d = (await cachedJson("fdot-divas", divasUrl(), waitUntil)) as { features?: unknown[]; error?: { message?: string } };
      if (d.error) throw new Error(d.error.message ?? "ArcGIS error");
      return (d.features ?? []).map((f) => fromDivas(f as Parameters<typeof fromDivas>[0])).filter(notNull);
    }),
    source("mdpd", async () => {
      const d = await cachedJson("mdpd", MDPD_URL, waitUntil);
      if (!Array.isArray(d)) throw new Error("unexpected answer");
      return d.map((r) => fromMdpd(r as Record<string, unknown>)).filter(notNull);
    }),
  ];
  if (env.FL511_API_KEY) {
    jobs.push(source("fl511", async () => {
      const d = await cachedJson("fl511", `${FL511}?key=${encodeURIComponent(env.FL511_API_KEY!)}&format=json`, waitUntil);
      return (Array.isArray(d) ? d : []).map((e) => fromFl511(e as Record<string, unknown>)).filter(notNull);
    }));
  }
  const tomtomKey = env.TOMTOM_API_KEY?.trim();
  if (tomtomKey) {
    jobs.push(source("tomtom", async () => {
      const cache = edgeCache();
      if (cache && !(await reserve(cacheBudgetStore(cache, waitUntil), "incidents"))) {
        throw new Error("budget");
      }
      const bbox = bboxAround(lat, lon, km);
      const d = (await cachedJson(`tomtom-inc-${bbox}`, TOMTOM_INCIDENTS(bbox, tomtomKey), waitUntil, INCIDENT_TTL_SEC)) as {
        incidents?: unknown[];
      };
      return (d.incidents ?? []).map((e) => fromTomTom(e as Parameters<typeof fromTomTom>[0])).filter(notNull);
    }));
  }
  const results = await Promise.all(jobs);
  const sources = results.map((r) => r.status);
  if (!env.FL511_API_KEY) sources.push({ source: "fl511", ok: false, count: 0, error: "no key (optional)" });
  if (!tomtomKey) sources.push({ source: "tomtom", ok: false, count: 0, error: "no key (optional)" });
  const official = results
    .filter((r) => r.status.source !== "tomtom")
    .flatMap((r) => withinKm(r.items, lat, lon, km));
  const tomtom = results
    .filter((r) => r.status.source === "tomtom")
    .flatMap((r) => withinKm(r.items, lat, lon, km));
  const items = foldTomTomIntoOfficial(official, tomtom)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 150);
  return json({ configured: true, sources, items });
}
