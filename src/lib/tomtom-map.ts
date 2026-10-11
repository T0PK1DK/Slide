/**
 * TomTom design helpers: opt-in vector basemap (style URL + key-safe rewrite),
 * search-row copy, map credit, and traffic/ETA chip text. No search, routing,
 * or traffic-proxy logic lives here — those stay in geocode / route-brain.
 */
import { TOMTOM_ATTRIBUTION } from "./tomtom-budget";
import { splitPlaceLabel } from "./place";
import { haversineMeters } from "./polyline";
import { arrivalClock, formatMiles } from "./smooth";
import type { Look } from "./garage";
import type { LonLat, SearchHit } from "./valhalla";

/** Map Display style version TomTom documents for MapLibre. */
export const TOMTOM_STYLE_VERSION = "22.2.1-9";
export const TOMTOM_MAP_PROXY = "/api/map/tt";

const TOMTOM_HOST = "api.tomtom.com";

/** Every look uses the dark street style; Ember/Sand are painted after load. */
export function tomtomStyleUrl(key: string, look: Look = "night"): string {
  const url = new URL(`https://${TOMTOM_HOST}/style/1/style/${TOMTOM_STYLE_VERSION}`);
  url.searchParams.set("key", key);
  url.searchParams.set("map", "2/basic_street-dark");
  url.searchParams.set("poi", "2/poi_dynamic");
  if (look === "sand") url.searchParams.set("map", "2/basic_street-dark");
  return url.toString();
}

/** Strip the secret from a TomTom asset URL and point it at our proxy. */
export function tomtomProxyUrl(href: string, proxyBase = TOMTOM_MAP_PROXY): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.hostname !== TOMTOM_HOST) return null;
  u.searchParams.delete("key");
  const q = u.searchParams.toString();
  // URL.pathname encodes MapLibre {z}/{fontstack} tokens; the style JSON needs them literal.
  const path = decodeURIComponent(u.pathname);
  return `${proxyBase}${path}${q ? `?${q}` : ""}${u.hash}`;
}

const PROXY_OK = /^(map|style|maps)(\/|$)/;

/** Path after `/api/map/tt/` — only TomTom map/style assets, no traversal. */
export function tomtomProxyPath(rest: string[]): string | null {
  const p = rest.filter(Boolean).join("/");
  if (!p || p.includes("..") || !PROXY_OK.test(p)) return null;
  return p;
}

/** Walk a style JSON and rewrite every api.tomtom.com URL so the key never ships. */
export function rewriteTomTomStyle(style: unknown, proxyBase = TOMTOM_MAP_PROXY): unknown {
  if (typeof style === "string") {
    if (!style.includes(TOMTOM_HOST)) return style;
    return tomtomProxyUrl(style, proxyBase) ?? style;
  }
  if (Array.isArray(style)) return style.map((x) => rewriteTomTomStyle(x, proxyBase));
  if (!style || typeof style !== "object") return style;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style as Record<string, unknown>)) {
    out[k] = rewriteTomTomStyle(v, proxyBase);
  }
  return out;
}

export type TomTomPaint = { prop: string; value: string };

/**
 * Paint overrides for a TomTom vector layer id/type. Unknown layers return
 * nothing — we never invent colours for a layer we don't recognise.
 */
export function tomtomPaintForLayer(
  id: string,
  type: string,
  colors: { land: string; water: string; road: string; roadCase: string; motorway: string; minor: string; park: string; building: string; path: string; label: string; halo: string },
): TomTomPaint[] {
  const n = id.toLowerCase();
  if (type === "background") return [{ prop: "background-color", value: colors.land }];
  if (type === "fill" && /water/.test(n)) return [{ prop: "fill-color", value: colors.water }];
  if (type === "fill" && /earth|landcover|background/.test(n) && !/water|park|wood|forest|build/.test(n)) {
    return [{ prop: "fill-color", value: colors.land }];
  }
  if (type === "fill" && /park|wood|forest|grass|national|green/.test(n)) return [{ prop: "fill-color", value: colors.park }];
  if (type === "fill" && /build|urban|built/.test(n)) return [{ prop: "fill-color", value: colors.building }];
  if (type === "line" && /water/.test(n)) return [{ prop: "line-color", value: colors.water }];
  if (type === "line" && /motorway|trunk/.test(n) && /outline|case|casing/.test(n)) return [{ prop: "line-color", value: colors.roadCase }];
  if (type === "line" && /motorway|trunk/.test(n)) return [{ prop: "line-color", value: colors.motorway }];
  if (type === "line" && /primary|major|secondary/.test(n) && /outline|case|casing/.test(n)) return [{ prop: "line-color", value: colors.roadCase }];
  if (type === "line" && /primary|major|secondary/.test(n)) return [{ prop: "line-color", value: colors.road }];
  if (type === "line" && /minor|street|residential|tertiary|service/.test(n)) return [{ prop: "line-color", value: colors.minor }];
  if (type === "line" && /path|track|foot|cycle/.test(n)) return [{ prop: "line-color", value: colors.path }];
  if (type === "symbol" && /place|road|label|name/.test(n)) {
    return [
      { prop: "text-color", value: colors.label },
      { prop: "text-halo-color", value: colors.halo },
    ];
  }
  return [];
}

export type MapCreditInput = { tomtomBasemap: boolean; tomtomTraffic: boolean };

/** Honest map credit. OSM/OpenMapTiles for the default style; TomTom when those tiles are on. */
export function mapCreditLine(input: MapCreditInput): string {
  if (input.tomtomBasemap) return TOMTOM_ATTRIBUTION;
  return input.tomtomTraffic ? `© OpenMapTiles © OSM · ${TOMTOM_ATTRIBUTION}` : "© OpenMapTiles © OSM";
}

export type SuggestRow = {
  name: string;
  address: string;
  distance: string | null;
  credit: string | null;
};

/**
 * Two-line search row from fields already on the hit. Distance is only the
 * haversine to a known pin (GPS / From) — never a new geocode.
 */
export function suggestRow(hit: SearchHit, from?: LonLat | null): SuggestRow {
  const split = splitPlaceLabel(hit.label);
  const name = (hit.name && hit.name.trim()) || split.name;
  let address = hit.label.trim();
  if (name && address.toLowerCase().startsWith(name.toLowerCase())) {
    address = address.slice(name.length).replace(/^,\s*/, "").trim();
  }
  if (!address || address === name) address = split.address === name ? "" : split.address;
  if (address === name) address = "";
  let distance: string | null = null;
  if (from && Number.isFinite(from.lon) && Number.isFinite(from.lat)) {
    const m = haversineMeters(from.lon, from.lat, hit.lon, hit.lat);
    if (Number.isFinite(m) && m >= 80) distance = formatMiles(m / 1609.344);
  }
  return {
    name,
    address,
    distance,
    credit: hit.source === "tomtom" ? TOMTOM_ATTRIBUTION : null,
  };
}

export type ChipSnapshot = {
  routeKey: string | null;
  live: boolean;
  delaySec: number;
  remainingSec: number;
};

/** `Traffic +N min` only when a live delay of at least 45 s is on the brain. */
export function trafficChipText(s: ChipSnapshot): string | null {
  if (!s.routeKey || !s.live || !(s.delaySec >= 45)) return null;
  return `Traffic +${Math.max(1, Math.round(s.delaySec / 60))} min`;
}

/** `Arrives 4:12 PM` from remaining seconds. Hidden when there is no countdown. */
export function arrivalChipText(s: ChipSnapshot, now = new Date()): string | null {
  if (!s.routeKey || !(s.remainingSec > 0)) return null;
  return `Arrives ${arrivalClock(s.remainingSec, now)}`;
}

export async function fetchTomTomStyle(look: Look, fetchImpl: typeof fetch = fetch): Promise<unknown | null> {
  try {
    const res = await fetchImpl(`/api/map/style?look=${encodeURIComponent(look)}`);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (!json || typeof json !== "object" || !("sources" in json)) return null;
    return json;
  } catch {
    return null;
  }
}
