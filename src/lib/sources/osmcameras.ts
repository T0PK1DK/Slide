import type { RadarItem } from "../reports";

/**
 * Traffic-enforcement cameras from OpenStreetMap (ODbL, © OpenStreetMap
 * contributors) via the public Overpass API: `highway=speed_camera` nodes and
 * the `device` members of `type=enforcement` relations (speed, red-light,
 * average-speed, school-zone). Coverage is only as complete as OSM's mapping,
 * and the UI says so. Fetched through /api/cameras, which caches per ~11 km tile.
 */
export function overpassQuery(s: number, w: number, n: number, e: number): string {
  const bbox = `${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)}`;
  return `[out:json][timeout:25];
node["highway"="speed_camera"](${bbox})->.a;
rel["type"="enforcement"](${bbox})->.r;
node(r.r:"device")->.d;
(.a;.d;.r;);
out body;`;
}

type OsmEl = { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; tags?: Record<string, string>; members?: Array<{ type: string; ref: number; role: string }> };

const LABEL: Record<string, string> = {
  maxspeed: "Speed camera",
  traffic_signals: "Red-light camera",
  average_speed: "Average-speed camera",
  mindistance: "Distance camera",
};

/** Pure: an Overpass JSON answer → camera radar items (one per device node). */
export function camerasFromOverpass(json: { elements?: OsmEl[] }): RadarItem[] {
  const els = json.elements ?? [];
  const enforcementOf = new Map<number, { what: string; maxspeed?: string }>();
  for (const r of els) {
    if (r.type !== "relation" || r.tags?.type !== "enforcement") continue;
    for (const m of r.members ?? []) {
      if (m.type === "node" && m.role === "device") enforcementOf.set(m.ref, { what: r.tags.enforcement ?? "maxspeed", maxspeed: r.tags.maxspeed });
    }
  }
  const out: RadarItem[] = [];
  for (const n of els) {
    if (n.type !== "node" || typeof n.lat !== "number" || typeof n.lon !== "number") continue;
    const enf = enforcementOf.get(n.id);
    const isCam = n.tags?.highway === "speed_camera" || enf;
    if (!isCam) continue;
    const what = enf?.what ?? "maxspeed";
    const limit = enf?.maxspeed ?? n.tags?.maxspeed;
    out.push({
      id: `osm-${n.id}`,
      source: "osm",
      kind: "camera",
      lat: n.lat,
      lon: n.lon,
      title: LABEL[what] ?? "Enforcement camera",
      detail: `OpenStreetMap${limit ? ` · posted ${limit.replace(/\s*mph/i, "")} mph` : ""}`,
      createdAt: 0,
      confirms: 0,
      reportId: null,
    });
  }
  return out;
}

/** Pure: the ~0.1° tile a point falls in, so nearby drivers share one cached Overpass call. */
export function cameraTile(lat: number, lon: number): { s: number; w: number; n: number; e: number; key: string } {
  const s = Math.floor(lat * 10) / 10, w = Math.floor(lon * 10) / 10;
  return { s, w, n: s + 0.1, e: w + 0.1, key: `${s.toFixed(1)}_${w.toFixed(1)}` };
}
