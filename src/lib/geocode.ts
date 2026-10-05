/**
 * Place search: Photon autocomplete, then Nominatim, then the US Census
 * geocoder for street addresses. Bias toward the driver, never a hard box.
 * Nominatim needs a Worker (User-Agent + 1 req/s). Census has no CORS, same.
 */
import { HttpError } from "../plan/failure";
import { haversineMeters } from "./polyline";
import type { LonLat, SearchHit } from "./valhalla";

export const PHOTON_URL = "https://photon.komoot.io/api";
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const CENSUS_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
export const GEOCODE_UA = "Slide/1 (+https://kings-slide.pages.dev)";
/** Shown when typed text does not resolve to a pin. */
export const NO_MATCH = "No match, try adding city";

export type SearchIntent = "suggest" | "resolve";
export type SearchOpts = {
  intent?: SearchIntent;
  /** Override fetch (tests). */
  fetch?: typeof fetch;
  /**
   * Browser: `/api/geocode` (Worker or Vite middleware) for Nominatim/Census.
   * Worker / tests / middleware: `""` to call those hosts directly.
   */
  proxy?: string;
  /** Skip Photon (the Function already expects the client to have tried it). */
  skipPhoton?: boolean;
  userAgent?: string;
  /** Nominatim gap in ms. Default 1000 (their 1 req/s rule). Tests pass 0. */
  nominatimGapMs?: number;
};

const MIAMI: LonLat = { lon: -80.1918, lat: 25.7617 };
const DIR: Record<string, string> = {
  n: "North",
  s: "South",
  e: "East",
  w: "West",
  ne: "Northeast",
  nw: "Northwest",
  se: "Southeast",
  sw: "Southwest",
};
const STREET: Record<string, string> = {
  ave: "Avenue",
  av: "Avenue",
  st: "Street",
  str: "Street",
  blvd: "Boulevard",
  dr: "Drive",
  rd: "Road",
  ln: "Lane",
  ct: "Court",
  pl: "Place",
  ter: "Terrace",
  terr: "Terrace",
  hwy: "Highway",
  pkwy: "Parkway",
  cir: "Circle",
  ft: "Fort",
};
const STATE: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
  mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina",
  nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee",
  tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming", dc: "DC",
};

let lastNominatimAt = 0;

export function resetNominatimClock(): void {
  lastNominatimAt = 0;
}

/** `26.12, -80.15` or `26.12,-80.15`. Integer pairs without a decimal are ignored. */
export function parseLatLng(query: string): SearchHit | null {
  const m = query.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  if (!m[1].includes(".") && !m[2].includes(".")) return null;
  let lat = Number(m[1]);
  let lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
    const swap = lat;
    lat = lon;
    lon = swap;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    lon,
    lat,
    kind: "coordinates",
  };
}

export function isZip(query: string): boolean {
  return /^\d{5}(?:-\d{4})?$/.test(query.trim());
}

export function isIntersection(query: string): boolean {
  return /(?:\s+(?:and|&|\/|@)\s+|\s+&\s+)/i.test(query);
}

/** House number at the start of a street address, not "6th" or a ZIP. */
export function leadingHouse(query: string): string | null {
  const m = query.trim().match(/^(\d+[A-Za-z]?)\s+\S/);
  if (!m) return null;
  if (/^\d+(?:st|nd|rd|th)$/i.test(m[1])) return null;
  return m[1];
}

export function looksCompleteQuery(query: string): boolean {
  const t = query.trim();
  if (t.length < 3) return false;
  if (parseLatLng(t) || isZip(t) || isIntersection(t)) return true;
  if (leadingHouse(t) && t.includes(",")) return true;
  return t.includes(",") && t.length >= 12;
}

/** Expand NW/Ave/FL so OSM geocoders can match street names. */
export function expandStreetQuery(query: string): string {
  const parts = query.split(/(\s+|,)/);
  let seenWord = false;
  return parts
    .map((tok) => {
      if (/^\s+$/.test(tok) || tok === ",") return tok;
      const clean = tok.replace(/\./g, "");
      const key = clean.toLowerCase();
      const first = !seenWord;
      seenWord = true;
      if (/^\d+[a-z]?$/i.test(clean)) return tok;
      if (key === "st" && first) return tok;
      if (DIR[key]) return DIR[key];
      if (STREET[key]) return STREET[key];
      if (clean.length === 2 && STATE[key]) return STATE[key];
      return tok;
    })
    .join("");
}

export function censusQuery(query: string): string {
  return query.replace(/\s+and\s+/gi, " & ");
}

export function hitHasHouse(hit: SearchHit, house: string): boolean {
  return new RegExp(`(?:^|\\b|,\\s*)${escapeRe(house)}(?:\\b|,|$)`, "i").test(hit.label);
}

export function hitLooksLikeIntersection(hit: SearchHit): boolean {
  if (hit.kind === "intersection" || /&/.test(hit.label)) return true;
  return /(?:ave(?:nue)?|st(?:reet)?|blvd|boulevard|r(?:oa)?d|dr(?:ive)?|ln|lane|hwy|highway|pkwy|way|ct|pl|ter(?:r)?)\b.{0,24}\/.{0,24}\b(?:ave(?:nue)?|st(?:reet)?|blvd|boulevard|r(?:oa)?d|dr(?:ive)?|ln|lane|hwy|highway|pkwy|way|ct|pl|ter(?:r)?)\b/i.test(
    hit.label
  );
}

export function resultsSatisfied(query: string, hits: SearchHit[]): boolean {
  if (!hits.length) return false;
  const house = leadingHouse(query);
  if (house) return hits.some((h) => hitHasHouse(h, house));
  if (isIntersection(query)) return hits.some(hitLooksLikeIntersection);
  return true;
}

export function hitsFromPhoton(data: { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }> } | null | undefined): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const f of data?.features ?? []) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const house = str(p.housenumber);
    const parts = [house, str(p.name), str(p.street), str(p.city) || str(p.county), str(p.state)]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    hits.push({
      label: parts.join(", ") || str(p.name) || "Place",
      name: str(p.name) || undefined,
      lon,
      lat,
      kind: str(p.osm_value) || str(p.type) || "place",
    });
  }
  return hits;
}

export function hitsFromNominatim(data: unknown): SearchHit[] {
  if (!Array.isArray(data)) return [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const addr = (r.address && typeof r.address === "object" ? r.address : {}) as Record<string, unknown>;
    const name = str(r.name) || str(addr.amenity) || str(addr.shop) || str(addr.tourism);
    const house = str(addr.house_number);
    const road = str(addr.road);
    const city = str(addr.city) || str(addr.town) || str(addr.village) || str(addr.hamlet);
    const state = str(addr.state);
    const parts = [house, name, road, city, state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    const label = parts.join(", ") || str(r.display_name) || "Place";
    hits.push({
      label,
      name: name || undefined,
      lon,
      lat,
      kind: str(r.addresstype) || str(r.type) || "place",
    });
  }
  return hits;
}

export function hitsFromCensus(data: unknown): SearchHit[] {
  const matches =
    data && typeof data === "object"
      ? ((data as { result?: { addressMatches?: unknown[] } }).result?.addressMatches ?? [])
      : [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as {
      matchedAddress?: string;
      coordinates?: { x?: number; y?: number };
    };
    const lon = Number(m.coordinates?.x);
    const lat = Number(m.coordinates?.y);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = titleAddress(m.matchedAddress || "Place");
    hits.push({
      label,
      lon,
      lat,
      kind: /&/.test(label) ? "intersection" : "address",
    });
  }
  return hits;
}

export function rankHits(query: string, hits: SearchHit[], bias?: LonLat): SearchHit[] {
  const house = leadingHouse(query);
  const zip = isZip(query);
  const inter = isIntersection(query);
  const here = bias ?? MIAMI;
  return hits
    .map((hit, i) => {
      let s = 0;
      if (house && hitHasHouse(hit, house)) s += 100;
      if (inter && hitLooksLikeIntersection(hit)) s += 80;
      if (zip && /postcode|postal|zip/i.test(hit.kind)) s += 50;
      const km = haversineMeters(here.lon, here.lat, hit.lon, hit.lat) / 1000;
      s += Math.max(0, 40 - km / 20);
      return { hit, s, i };
    })
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.hit);
}

export function mergeHits(...lists: SearchHit[][]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const list of lists) {
    for (const hit of list) {
      const key = `${hit.lon.toFixed(5)},${hit.lat.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
    }
  }
  return out;
}

/**
 * Autocomplete (`suggest`) and pin-a-place (`resolve`) share this chain.
 * Typed lat,lng never leaves the device. Street house numbers that Photon
 * misses fall through to Census / Nominatim instead of a nearby POI.
 */
export async function searchPlaces(query: string, bias?: LonLat, opts: SearchOpts = {}): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pin = parseLatLng(q);
  if (pin) return [pin];
  const intent = opts.intent ?? "suggest";
  const here = bias ?? MIAMI;

  let photonErr: unknown = null;
  let hits: SearchHit[] = [];
  if (!opts.skipPhoton) {
    try {
      hits = await photonSearch(q, here, opts);
      const expanded = expandStreetQuery(q);
      if (expanded !== q && !resultsSatisfied(q, hits)) {
        hits = mergeHits(hits, await photonSearch(expanded, here, opts));
      }
    } catch (err) {
      photonErr = err;
    }
  }

  if (!resultsSatisfied(q, hits)) {
    try {
      hits = mergeHits(hits, await fallbackPlaces(q, here, intent, opts));
    } catch (err) {
      if (!hits.length) throw photonErr ?? err;
    }
  }

  const ranked = rankHits(q, hits, here);
  if (intent === "resolve" && (leadingHouse(q) || isIntersection(q)) && !resultsSatisfied(q, ranked)) {
    return [];
  }
  return ranked;
}

/** Nominatim + Census. Used by `/api/geocode` and as the client fallback. */
export async function fallbackPlaces(query: string, bias: LonLat | undefined, intent: SearchIntent, opts: SearchOpts = {}): Promise<SearchHit[]> {
  const proxy = opts.proxy ?? defaultProxy();
  if (proxy) return fromProxy(proxy, query, bias, intent, opts);
  const q = query.trim();
  const here = bias ?? MIAMI;
  const street = !!(leadingHouse(q) || isIntersection(q));
  let hits: SearchHit[] = [];
  if (street) {
    hits = await censusSearch(censusQuery(q), opts);
    if (resultsSatisfied(q, hits)) return hits;
  }
  if (intent === "resolve" || (street && !hits.length)) {
    hits = mergeHits(hits, await nominatimSearch(q, here, opts));
    const expanded = expandStreetQuery(q);
    if (expanded !== q && !resultsSatisfied(q, hits)) {
      hits = mergeHits(hits, await nominatimSearch(expanded, here, opts));
    }
  }
  return hits;
}

function defaultProxy(): string {
  return typeof window !== "undefined" ? "/api/geocode" : "";
}

async function fromProxy(proxy: string, query: string, bias: LonLat | undefined, intent: SearchIntent, opts: SearchOpts): Promise<SearchHit[]> {
  const url = new URL(proxy, "http://slide.local");
  url.searchParams.set("q", query);
  url.searchParams.set("intent", intent);
  if (bias) {
    url.searchParams.set("lat", String(bias.lat));
    url.searchParams.set("lon", String(bias.lon));
  }
  const path = `${proxy.split("?")[0]}?${url.searchParams.toString()}`;
  const data = await getJson(path, opts) as { hits?: SearchHit[] };
  return Array.isArray(data.hits) ? data.hits.filter(isHit) : [];
}

async function photonSearch(query: string, bias: LonLat, opts: SearchOpts): Promise<SearchHit[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lon", String(bias.lon));
  url.searchParams.set("lat", String(bias.lat));
  return hitsFromPhoton((await getJson(url.toString(), opts)) as Parameters<typeof hitsFromPhoton>[0]);
}

async function censusSearch(query: string, opts: SearchOpts): Promise<SearchHit[]> {
  const url = new URL(CENSUS_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    return hitsFromCensus(await getJson(url.toString(), opts));
  } catch {
    return [];
  }
}

async function nominatimSearch(query: string, bias: LonLat, opts: SearchOpts): Promise<SearchHit[]> {
  const gap = opts.nominatimGapMs ?? 1000;
  const wait = gap - (Date.now() - lastNominatimAt);
  if (lastNominatimAt && gap > 0 && wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set(
    "viewbox",
    `${bias.lon - 0.7},${bias.lat + 0.7},${bias.lon + 0.7},${bias.lat - 0.7}`
  );
  url.searchParams.set("bounded", "0");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.userAgent) headers["User-Agent"] = opts.userAgent;
  try {
    return hitsFromNominatim(await getJson(url.toString(), opts, headers));
  } catch {
    return [];
  }
}

async function getJson(url: string, opts: SearchOpts, extraHeaders?: Record<string, string>): Promise<unknown> {
  const run = opts.fetch ?? fetch;
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 700));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    let status: number | null = null;
    try {
      const headers: Record<string, string> = { ...(extraHeaders ?? {}) };
      if (opts.userAgent && !headers["User-Agent"]) headers["User-Agent"] = opts.userAgent;
      const res = await run(url, { headers, signal: ctrl.signal });
      status = res.status;
      if (!res.ok) throw new HttpError(res.status, null, "");
      return await res.json();
    } catch (err) {
      last = err;
      if (status !== null && status !== 429 && status < 500) break;
    } finally {
      clearTimeout(t);
    }
  }
  throw last;
}

function isHit(v: SearchHit): v is SearchHit {
  return !!v && typeof v.label === "string" && Number.isFinite(v.lon) && Number.isFinite(v.lat);
}

function str(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleAddress(s: string): string {
  return s.replace(/[A-Za-z][A-Za-z']*/g, (w) => {
    if (/^(FL|NY|DC|NW|NE|SW|SE|US|USA)$/i.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}
