import type { RadarItem, RadarKind } from "../reports";

/**
 * FDOT DIVAS events (the public ArcGIS layer behind FL511's map: crashes,
 * disabled vehicles, congestion, roadwork) → radar items. No key needed.
 * Layer: gis.fdot.gov/arcgis/rest/services/DIVAS_GetEvent/FeatureServer/0
 * Fields used: id, descriptionen, eventtypedesc, severity, county, highway,
 * direction, latitude/longitude, timestamp (UTC, "MM/DD/YYYY h:mm:ss AM").
 */
type Attrs = Record<string, unknown>;

export const DIVAS_QUERY =
  "https://gis.fdot.gov/arcgis/rest/services/DIVAS_GetEvent/FeatureServer/0/query";

/** South Florida box: Palm Beach to the Keys, coast to the Everglades. */
export function divasUrl(box: [number, number, number, number] = [-81.6, 24.4, -79.9, 27.2]): string {
  const q = new URLSearchParams({
    where: "1=1",
    geometry: box.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });
  return `${DIVAS_QUERY}?${q}`;
}

/** Pure: "10/04/2026 2:02:06 PM" (UTC) → epoch ms, or NaN. */
export function parseUsUtc(s: string): number {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))? ?(AM|PM)?$/i.exec(s.trim());
  if (!m) return NaN;
  let h = Number(m[4]);
  if (m[7]) h = (h % 12) + (m[7].toUpperCase() === "PM" ? 12 : 0);
  return Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h, Number(m[5]), Number(m[6] ?? 0));
}

/** Pure: DIVAS event type (+ description) → radar kind. */
export function divasKind(type: string, desc: string): RadarKind {
  const t = type.toLowerCase();
  if (/all lanes (are )?(blocked|closed)|road closed|closure/.test(`${t} ${desc.toLowerCase()}`)) return "closure";
  if (/crash|accident/.test(t)) return "crash";
  if (/road ?work|construction|maintenance/.test(t)) return "roadwork";
  if (/congestion|backup|delay/.test(t)) return "jam";
  return "hazard"; // disabled vehicle, debris, emergency vehicles, weather…
}

const DIR: Record<string, string> = { n: "N", s: "S", e: "E", w: "W", nb: "N", sb: "S", eb: "E", wb: "W" };

/** Pure: one DIVAS feature → radar item, or null without a usable position. */
export function fromDivas(f: { attributes?: Attrs; geometry?: { x?: number; y?: number } }): RadarItem | null {
  const a = f.attributes ?? {};
  const lat = Number(a.latitude ?? f.geometry?.y);
  const lon = Number(a.longitude ?? f.geometry?.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  const type = String(a.eventtypedesc ?? "").trim();
  const desc = String(a.descriptionen ?? "").replace(/\s+/g, " ").trim();
  const kind = divasKind(type, desc);
  const road = String(a.highway ?? "").trim();
  const dir = DIR[String(a.direction ?? "").trim().toLowerCase()] ?? "";
  const when = parseUsUtc(String(a.timestamp ?? ""));
  return {
    id: `fdot-${String(a.id ?? `${lat},${lon}`)}`,
    source: "fdot",
    kind,
    lat,
    lon,
    title: [type || "Incident", road && `on ${road}`, dir].filter(Boolean).join(" "),
    detail: `FDOT · ${desc.slice(0, 160) || "Official event"}`,
    createdAt: Number.isFinite(when) ? when : Date.now(),
    confirms: 0,
    reportId: null,
  };
}
