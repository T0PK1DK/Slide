import type { RadarItem, RadarKind } from "../reports";

/**
 * Florida 511 (FDOT) events → radar items. FL511 runs the IBI "511" platform;
 * its v2 event feed is `https://fl511.com/api/v2/get/event?key=…&format=json`
 * (free developer key from fl511.com). Field names vary in case between 511
 * deployments, so every field is read defensively. NOT yet verified against a
 * live response — check the first real payload and adjust `pick()` names.
 */
type Raw = Record<string, unknown>;

function pick(o: Raw, ...names: string[]): unknown {
  for (const n of names) {
    if (o[n] !== undefined && o[n] !== null && o[n] !== "") return o[n];
    const lower = Object.keys(o).find((k) => k.toLowerCase() === n.toLowerCase());
    if (lower && o[lower] !== undefined && o[lower] !== null && o[lower] !== "") return o[lower];
  }
  return undefined;
}

/** Pure: FL511 event type text → radar kind, or null to skip (e.g. special events). */
export function fl511Kind(type: string, fullClosure: boolean): RadarKind | null {
  const t = type.toLowerCase();
  if (fullClosure || /closure|closed/.test(t)) return "closure";
  if (/accident|crash|incident|disabled|vehicle/.test(t)) return "crash";
  if (/roadwork|construction|maintenance|lane/.test(t)) return "roadwork";
  if (/congestion|delay/.test(t)) return "jam";
  if (/debris|hazard|weather|flood/.test(t)) return "hazard";
  return null;
}

const TITLE: Record<RadarKind, string> = {
  police: "Police activity",
  crash: "Crash",
  hazard: "Hazard",
  closure: "Road closed",
  jam: "Congestion",
  roadwork: "Roadwork",
  camera: "Enforcement camera",
  bus: "Bus",
  rail: "Train",
};

/** Pure: one FL511 event → radar item, or null if it has no usable position/type. */
export function fromFl511(e: Raw): RadarItem | null {
  const lat = Number(pick(e, "Latitude", "lat"));
  const lon = Number(pick(e, "Longitude", "lon", "lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  const type = String(pick(e, "EventType", "Type", "EventSubType") ?? "");
  const full = pick(e, "IsFullClosure") === true || String(pick(e, "IsFullClosure")) === "true";
  const kind = fl511Kind(`${type} ${pick(e, "EventSubType") ?? ""}`, full);
  if (!kind) return null;
  const road = String(pick(e, "RoadwayName", "Roadway") ?? "").trim();
  const dir = String(pick(e, "DirectionOfTravel", "Direction") ?? "").trim();
  const desc = String(pick(e, "Description") ?? "").replace(/\s+/g, " ").trim();
  const reported = Date.parse(String(pick(e, "Reported", "StartDate", "LastUpdated") ?? ""));
  return {
    id: `fl511-${String(pick(e, "ID", "Id", "EventId") ?? `${lat},${lon}`)}`,
    source: "fl511",
    kind,
    lat,
    lon,
    title: [TITLE[kind], road && `on ${road}`, dir && dir !== "None" ? dir : ""].filter(Boolean).join(" "),
    detail: `FL511 · ${desc.slice(0, 140) || "Official incident"}`,
    createdAt: Number.isFinite(reported) ? reported : Date.now(),
    confirms: 0,
    reportId: null,
  };
}

/** Pure: keep items inside a box of `km` around a point. */
export function withinKm(items: RadarItem[], lat: number, lon: number, km: number): RadarItem[] {
  const dLat = km / 111, dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  return items.filter((i) => Math.abs(i.lat - lat) <= dLat && Math.abs(i.lon - lon) <= dLon);
}
