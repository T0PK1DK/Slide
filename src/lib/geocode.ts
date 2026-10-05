/**
 * Place search + geocode. Photon is still the first look (POIs, names, ZIP
 * centroids). Street addresses and US intersections often miss there, so a
 * typed query that wasn't tapped from the list is resolved through Nominatim
 * then the US Census geocoder. Bias is a hint, never a fence.
 */
import type { LonLat, SearchHit } from "./valhalla";
import { haversineMeters } from "./polyline";
import { HttpError } from "../plan/failure";

export const PHOTON_URL = "https://photon.komoot.io/api";
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
export const SLIDE_UA = "Slide/1 (+https://kings-slide.pages.dev)";
export const DEFAULT_BIAS: LonLat = { lon: -80.1918, lat: 25.7617 };

export type QueryKind = "coords" | "zip" | "address" | "intersection" | "place";
export type GeocodeMode = "suggest" | "resolve";

export type GeocodeOpts = {
  mode?: GeocodeMode;
  limit?: number;
  bias?: LonLat;
  /** Nominatim needs a real User-Agent, so the browser skips it. */
  nominatim?: boolean;
  nominatimMinMs?: number;
  fetch?: typeof fetch;
};

const STREET_WORD =
  /\b(ave|avenue|av|blvd|boulevard|st|street|dr|drive|rd|road|ct|court|ln|lane|way|pkwy|parkway|hwy|highway|cir|circle|ter|terrace|pl|place|trl|trail|loop|pass|pike|run|row|sq|square|xing|crossing|expy|expressway|fwy|freeway)\b/i;
const INTERSECTION = /\s+(&|and|\/|at|@)\s+/i;
const US_STATE = /\b(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/i;
const SUFFIXES: Record<string, string> = {
  ave: "Avenue",
  av: "Avenue",
  blvd: "Boulevard",
  st: "Street",
  dr: "Drive",
  rd: "Road",
  ct: "Court",
  ln: "Lane",
  pkwy: "Parkway",
  hwy: "Highway",
  cir: "Circle",
  ter: "Terrace",
  pl: "Place",
  trl: "Trail",
  sq: "Square",
  expy: "Expressway",
  fwy: "Freeway",
};
const CARDINALS: Record<string, string> = {
  n: "North",
  s: "South",
  e: "East",
  w: "West",
  ne: "Northeast",
  nw: "Northwest",
  se: "Southeast",
  sw: "Southwest",
};
const STATE_ABBR = new Set(
  "al ak az ar ca co ct dc de fl ga hi ia id il in ks ky la ma md me mi mn mo ms mt nc nd ne nh nj nm nv ny oh ok or pa ri sc sd tn tx ut va vt wa wi wv wy"
    .split(" ")
);

let lastNominatimAt = 0;

/** Test hook: don't make the Nominatim 1 req/s gate leak across cases. */
export function resetNominatimGate(): void {
  lastNominatimAt = 0;
}

export function parseLatLng(query: string): LonLat | null {
  const t = query.trim();
  const m = t.match(/^(-?\d{1,3}\.\d+)\s*[,/\s]\s*(-?\d{1,3}\.\d+)\s*$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
  // lon,lat only when the first number cannot be a latitude (e.g. -80.2, 25.8 is
  // still read as lat,lng — US west longitudes are valid latitudes).
  if (Math.abs(a) > 90 && Math.abs(a) <= 180 && Math.abs(b) <= 90) return { lat: b, lon: a };
  return null;
}

export function classifyQuery(query: string): QueryKind {
  if (parseLatLng(query)) return "coords";
  const t = query.trim();
  if (/^\d{5}(?:-\d{4})?$/.test(t)) return "zip";
  if (INTERSECTION.test(t) && STREET_WORD.test(t)) return "intersection";
  if (/^\d+\s+\S/.test(t) && STREET_WORD.test(t)) return "address";
  return "place";
}

export function queryHouseNumber(query: string): string | null {
  const m = query.trim().match(/^(\d+[a-z]?)\b/i);
  return m ? m[1] : null;
}

export function expandStreetAbbreviations(query: string): string {
  return query.replace(/[A-Za-z]+/g, (tok, offset: number) => {
    const k = tok.toLowerCase();
    if (STATE_ABBR.has(k)) return tok;
    if (CARDINALS[k] && tok.length <= 2) return CARDINALS[k];
    if (SUFFIXES[k]) {
      if (k === "st" && offset === 0) return tok;
      return SUFFIXES[k];
    }
    return tok;
  });
}

export function hnMatches(hit: SearchHit, query: string): boolean {
  const want = queryHouseNumber(query);
  if (!want) return false;
  const fromLabel = hit.label.match(/^(\d+[a-z]?)\b/i)?.[1];
  const got = hit.housenumber ?? fromLabel;
  return !!got && got.toLowerCase() === want.toLowerCase();
}

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

export function hitsFromPhoton(data: unknown): SearchHit[] {
  const features = (data as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const housenumber = str(p.housenumber);
    const name = str(p.name);
    const street = str(p.street);
    const city = str(p.city) || str(p.county);
    const state = str(p.state);
    const parts = [housenumber, name, street, city, state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    hits.push({
      label: parts.join(", ") || name || "Place",
      name: name || undefined,
      lon,
      lat,
      kind: str(p.osm_value) || str(p.type) || "place",
      housenumber: housenumber || undefined,
      source: "photon",
    });
  }
  return hits;
}

type NominatimRow = {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
  name?: unknown;
  type?: unknown;
  addresstype?: unknown;
  address?: Record<string, unknown>;
};

export function hitsFromNominatim(data: unknown): SearchHit[] {
  if (!Array.isArray(data)) return [];
  const hits: SearchHit[] = [];
  for (const row of data as NominatimRow[]) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const address = row.address ?? {};
    const housenumber = str(address.house_number);
    const label = str(row.display_name) || str(row.name) || "Place";
    hits.push({
      label,
      name: str(row.name) || undefined,
      lon,
      lat,
      kind: str(row.type) || str(row.addresstype) || "place",
      housenumber: housenumber || undefined,
      source: "nominatim",
    });
  }
  return hits;
}

type CensusMatch = {
  matchedAddress?: unknown;
  coordinates?: { x?: unknown; y?: unknown };
  addressComponents?: { fromAddress?: unknown };
};

export function hitsFromCensus(data: unknown): SearchHit[] {
  const matches = (data as { result?: { addressMatches?: CensusMatch[] } } | null)?.result?.addressMatches;
  if (!Array.isArray(matches)) return [];
  const hits: SearchHit[] = [];
  for (const m of matches) {
    const lon = Number(m.coordinates?.x);
    const lat = Number(m.coordinates?.y);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const raw = str(m.matchedAddress);
    const housenumber = str(m.addressComponents?.fromAddress);
    hits.push({
      label: prettifyCensusAddress(raw) || raw || "Place",
      lon,
      lat,
      kind: raw.includes("&") ? "intersection" : "address",
      housenumber: housenumber || undefined,
      source: "census",
    });
  }
  return hits;
}

/** Census answers in ALL CAPS; keep state abbreviations loud, title-case the rest. */
export function prettifyCensusAddress(raw: string): string {
  if (!raw) return raw;
  return raw
    .split(/(\s+|,)/)
    .map((tok) => {
      if (!tok || /^[\s,]+$/.test(tok)) return tok;
      const comma = tok.endsWith(",") ? "," : "";
      const core = tok.replace(/,$/, "");
      if (/^(N|S|E|W|NE|NW|SE|SW)$/i.test(core)) return core.toUpperCase() + comma;
      if (core.length === 2 && US_STATE.test(core)) return core.toUpperCase() + comma;
      if (/^\d+[A-Za-z]+$/.test(core)) return core.replace(/[A-Za-z]+/, (s) => s.toLowerCase()) + comma;
      if (/^\d/.test(core) || core === "&") return tok;
      return core.charAt(0).toUpperCase() + core.slice(1).toLowerCase() + comma;
    })
    .join("");
}

export function preferNearBias(hits: SearchHit[], bias?: LonLat): SearchHit[] {
  if (!hits.length) return hits;
  let pool = hits;
  if (bias && inUsa(bias)) {
    const us = hits.filter(inUsa);
    if (us.length) pool = us;
  }
  if (!bias) return pool;
  return [...pool].sort(
    (a, b) => haversineMeters(bias.lon, bias.lat, a.lon, a.lat) - haversineMeters(bias.lon, bias.lat, b.lon, b.lat)
  );
}

/** Hits from one provider that are good enough to stop the resolve chain. */
export function pickResolved(query: string, hits: SearchHit[], bias?: LonLat): SearchHit[] {
  const kind = classifyQuery(query);
  if (kind === "coords") {
    const ll = parseLatLng(query);
    return ll ? [coordHit(ll, query)] : [];
  }
  if (kind === "address") return hits.filter((h) => hnMatches(h, query));
  if (kind === "zip") return preferNearBias(hits, bias);
  if (kind === "intersection") return hits.filter((h) => h.kind === "intersection" || /&/.test(h.label));
  return hits;
}

function inUsa(p: { lat: number; lon: number }): boolean {
  return p.lat > 24 && p.lat < 50 && p.lon < -66 && p.lon > -125;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

function coordHit(ll: LonLat, query?: string): SearchHit {
  return {
    label: query?.trim() || `${ll.lat}, ${ll.lon}`,
    lon: ll.lon,
    lat: ll.lat,
    kind: "coordinates",
    source: "coords",
  };
}

function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const key = `${h.lon.toFixed(5)},${h.lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

async function fetchJson(url: string, init: RequestInit, ms: number, fetchImpl: typeof fetch): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new HttpError(res.status, null, "");
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function photonSearch(q: string, bias: LonLat, limit: number, fetchImpl: typeof fetch): Promise<SearchHit[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "en");
  url.searchParams.set("lon", String(bias.lon));
  url.searchParams.set("lat", String(bias.lat));
  return hitsFromPhoton(await fetchJson(url.toString(), { headers: { accept: "application/json" } }, 8000, fetchImpl));
}

async function nominatimSearch(q: string, bias: LonLat, limit: number, minMs: number, fetchImpl: typeof fetch): Promise<SearchHit[]> {
  const wait = lastNominatimAt + minMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");
  const pad = 1.5;
  url.searchParams.set("viewbox", `${bias.lon - pad},${bias.lat + pad},${bias.lon + pad},${bias.lat - pad}`);
  url.searchParams.set("bounded", "0");
  return hitsFromNominatim(
    await fetchJson(url.toString(), { headers: { accept: "application/json", "user-agent": SLIDE_UA } }, 8000, fetchImpl)
  );
}

async function censusSearch(q: string, fetchImpl: typeof fetch): Promise<SearchHit[]> {
  const url = new URL(CENSUS_URL);
  url.searchParams.set("address", q);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  return hitsFromCensus(await fetchJson(url.toString(), { headers: { accept: "application/json" } }, 10000, fetchImpl));
}

function allowNominatim(opts: GeocodeOpts): boolean {
  if (opts.nominatim === false) return false;
  if (opts.nominatim === true) return true;
  return typeof window === "undefined";
}

/**
 * One search: suggest (Photon + Census for US streets) or resolve (stop at the
 * first provider that actually matches the typed text).
 */
export async function runGeocode(query: string, opts: GeocodeOpts = {}): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const coords = parseLatLng(q);
  if (coords) return [coordHit(coords, q)];
  if (q.length < 2) return [];

  const mode: GeocodeMode = opts.mode ?? "resolve";
  const bias = opts.bias ?? DEFAULT_BIAS;
  const limit = Math.min(Math.max(opts.limit ?? (mode === "resolve" ? 5 : 8), 1), 12);
  const fetchImpl = opts.fetch ?? fetch;
  const kind = classifyQuery(q);
  let lastErr: unknown;
  let anyOk = false;

  const tryCall = async (fn: () => Promise<SearchHit[]>): Promise<SearchHit[] | undefined> => {
    try {
      const hits = await fn();
      anyOk = true;
      return hits;
    } catch (err) {
      lastErr = err;
      return undefined;
    }
  };

  const photon = await tryCall(() => photonSearch(q, bias, limit, fetchImpl));
  const expanded = expandStreetAbbreviations(q);
  let photonExp: SearchHit[] | undefined;
  if (expanded !== q && kind === "address" && !(photon ?? []).some((h) => hnMatches(h, q))) {
    photonExp = await tryCall(() => photonSearch(expanded, bias, limit, fetchImpl));
  }
  const photonAll = dedupe([...(photon ?? []), ...(photonExp ?? [])]);

  if (mode === "suggest") {
    const extras: SearchHit[] = [];
    if (kind === "address" || kind === "intersection") {
      const census = await tryCall(() => censusSearch(q, fetchImpl));
      if (census) extras.push(...census);
    }
    const ranked = kind === "zip" ? preferNearBias(photonAll, bias) : photonAll;
    const out = dedupe([...pickResolved(q, extras, bias), ...extras, ...ranked]).slice(0, limit);
    if (out.length) return out;
    if (!anyOk && lastErr) throw lastErr;
    return [];
  }

  const photonPick = pickResolved(q, photonAll, bias);
  if (photonPick.length) return photonPick.slice(0, 1);

  let nom: SearchHit[] | undefined;
  if (allowNominatim(opts)) {
    nom = await tryCall(() => nominatimSearch(q, bias, limit, opts.nominatimMinMs ?? 1000, fetchImpl));
    if (nom) {
      const picked = pickResolved(q, nom, bias);
      if (picked.length) return picked.slice(0, 1);
      if (kind === "place" || kind === "zip") {
        const ranked = preferNearBias(nom, bias);
        if (ranked.length) return ranked.slice(0, 1);
      }
    }
  }

  if (kind === "address" || kind === "intersection" || US_STATE.test(q) || /^\d{5}/.test(q)) {
    const census = await tryCall(() => censusSearch(q, fetchImpl));
    if (census && census.length) {
      const picked = pickResolved(q, census, bias);
      return (picked.length ? picked : census).slice(0, 1);
    }
  }

  if (nom?.length) return preferNearBias(nom, bias).slice(0, 1);
  // A Photon POI on the same street (the fire house for "1020 NW 6th Ave") is
  // worse than "no match" for a house number, so skip it on addresses.
  if (kind !== "address" && photonAll.length) return photonAll.slice(0, 1);
  if (!anyOk && lastErr) throw lastErr;
  return [];
}

export async function handleGeocodeRequest(requestUrl: string, fetchImpl?: typeof fetch): Promise<{ hits: SearchHit[]; error?: string }> {
  const url = new URL(requestUrl, "https://kings-slide.pages.dev");
  const q = url.searchParams.get("q") ?? "";
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const mode: GeocodeMode = url.searchParams.get("mode") === "suggest" ? "suggest" : "resolve";
  const limit = Number(url.searchParams.get("limit"));
  const bias = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined;
  try {
    const hits = await runGeocode(q, {
      mode,
      limit: Number.isFinite(limit) ? limit : undefined,
      bias,
      nominatim: true,
      fetch: fetchImpl,
    });
    return { hits };
  } catch (err) {
    return { hits: [], error: err instanceof Error ? err.message : "search failed" };
  }
}

async function viaApi(query: string, bias: LonLat | undefined, mode: GeocodeMode): Promise<SearchHit[] | null> {
  if (typeof window === "undefined") return null;
  const url = new URL("/api/geocode", window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("mode", mode);
  if (bias) {
    url.searchParams.set("lat", String(bias.lat));
    url.searchParams.set("lon", String(bias.lon));
  }
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok || !ct.includes("json")) return null;
  const data = (await res.json()) as { hits?: SearchHit[] };
  return Array.isArray(data.hits) ? data.hits : null;
}

/** Autocomplete while typing. Debounced by the HUD, not here. */
export async function searchPlaces(query: string, bias?: LonLat): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2 && !parseLatLng(q)) return [];
  try {
    const api = await viaApi(q, bias, "suggest");
    if (api) return api;
  } catch {
    /* Pages Function missing (plain Vite without the plugin) — fall through. */
  }
  return runGeocode(q, { mode: "suggest", bias, nominatim: false });
}

/** First good pin for the raw typed text. Null means nothing matched. */
export async function geocode(query: string, bias?: LonLat): Promise<SearchHit | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const api = await viaApi(q, bias, "resolve");
    if (api) return api[0] ?? null;
  } catch {
    /* fall through */
  }
  const hits = await runGeocode(q, { mode: "resolve", bias, nominatim: false });
  return hits[0] ?? null;
}
