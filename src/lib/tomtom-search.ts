import type { SearchHit } from "./valhalla";
import { TOMTOM_ATTRIBUTION } from "./tomtom-budget";

/**
 * TomTom Search / Fuzzy (+ typeahead) → SearchHit. Autocomplete strings
 * without a position are dropped — the HUD needs a pin.
 */
type TomTomPos = { lat?: unknown; lon?: unknown };
type TomTomAddr = {
  freeformAddress?: unknown;
  streetNumber?: unknown;
  streetName?: unknown;
  municipality?: unknown;
  countrySubdivision?: unknown;
  postalCode?: unknown;
};
type TomTomRow = {
  type?: unknown;
  poi?: { name?: unknown };
  address?: TomTomAddr;
  position?: TomTomPos;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export function hitsFromTomTom(data: unknown): SearchHit[] {
  const results = (data as { results?: TomTomRow[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const row of results) {
    const lat = Number(row.position?.lat);
    const lon = Number(row.position?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const addr = row.address ?? {};
    const housenumber = str(addr.streetNumber);
    const name = str(row.poi?.name);
    const label = str(addr.freeformAddress) || [housenumber, name || str(addr.streetName), str(addr.municipality), str(addr.countrySubdivision)].filter(Boolean).join(", ");
    hits.push({
      label: label || name || "Place",
      name: name || undefined,
      lon,
      lat,
      kind: str(row.type) || "place",
      housenumber: housenumber || undefined,
      source: "tomtom",
    });
  }
  return hits;
}

/** Autocomplete value strings (no pin). Used only to rewrite a short query before Fuzzy. */
export function completionsFromTomTom(data: unknown): string[] {
  const results = (data as { results?: Array<{ segments?: Array<{ value?: unknown }> }> } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: string[] = [];
  for (const row of results) {
    const parts = (row.segments ?? []).map((s) => str(s.value).trim()).filter(Boolean);
    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

export const TOMTOM_SEARCH_ATTR = TOMTOM_ATTRIBUTION;
