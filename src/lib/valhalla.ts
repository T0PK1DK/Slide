export const VALHALLA_URL =
  "https://valhalla1.openstreetmap.de";
export const PHOTON_URL = "https://photon.komoot.io/api";

export type LonLat = { lon: number; lat: number };

export type SearchHit = {
  label: string;
  lon: number;
  lat: number;
  kind: string;
};

export type Maneuver = {
  type: number;
  instruction: string;
  verbal_pre_transition_instruction?: string;
  time: number;
  length: number;
  begin_shape_index: number;
  end_shape_index: number;
  travel_mode?: string;
  street_names?: string[];
  speed_limit?: number;
};

export type ValhallaSummary = {
  time: number;
  length: number;
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  has_time_restrictions?: boolean;
};

export type ValhallaLeg = {
  summary: ValhallaSummary;
  shape: string;
  maneuvers: Maneuver[];
};

export type ValhallaTrip = {
  status: number;
  status_message: string;
  units: string;
  summary: ValhallaSummary;
  legs: ValhallaLeg[];
  locations: Array<{ lat: number; lon: number; type?: string }>;
};

export type RouteResponse = {
  trip: ValhallaTrip;
  alternatives?: Array<{ trip: ValhallaTrip }>;
};

export type EdgeAttribute = {
  length: number;
  speed?: number;
  speed_limit?: number;
  free_flow_speed?: number;
  predicted_speed?: number;
  current_speed?: number;
  road_class?: string;
  use?: string;
  surface?: string;
  names?: string[];
  way_id?: number;
  lane_count?: number;
  truck_route?: boolean;
  traffic_signal?: boolean;
  begin_heading?: number;
  end_heading?: number;
  weighted_grade?: number;
};

export type TraceAttributes = {
  edges?: EdgeAttribute[];
  shape?: string;
  matched_points?: unknown[];
};

const SMOOTH_COSTING = {
  costing: "auto",
  costing_options: {
    auto: {
      maneuver_penalty: 12,
      alley_penalty: 8,
      gate_penalty: 80,
      service_penalty: 22,
      service_factor: 1.4,
      use_highways: 0.55,
      use_tolls: 0.5,
      use_ferry: 0.2,
      use_tracks: 0,
      use_living_streets: 0.1,
      top_speed: 130,
      shortest: false,
    },
  },
};

async function fetchJson(url: string, init: RequestInit = {}, ms = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function searchPlaces(query: string, bias?: LonLat): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lon", String(bias?.lon ?? -80.13));
  url.searchParams.set("lat", String(bias?.lat ?? 25.89));
  const data = await fetchJson(url.toString());
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    const [lon, lat] = f.geometry.coordinates;
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parts = [p.housenumber, p.name, p.street, p.city || p.county, p.state]
      .filter(Boolean)
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    hits.push({
      label: parts.join(", "),
      lon,
      lat,
      kind: p.osm_value || p.type || "place",
    });
  }
  return hits;
}

export async function requestRoutes(
  origin: LonLat,
  dest: LonLat,
  units: "miles" | "kilometers" = "miles"
): Promise<RouteResponse> {
  const body = {
    locations: [
      { lon: origin.lon, lat: origin.lat, type: "break" },
      { lon: dest.lon, lat: dest.lat, type: "break" },
    ],
    ...SMOOTH_COSTING,
    units,
    alternatives: true,
    directions_options: { units, language: "en-US" },
    id: "slide",
  };

  return fetchJson(`${VALHALLA_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 12000);
}

export async function requestFastRoute(
  origin: LonLat,
  dest: LonLat,
  units: "miles" | "kilometers" = "miles"
): Promise<RouteResponse> {
  const body = {
    locations: [
      { lon: origin.lon, lat: origin.lat, type: "break" },
      { lon: dest.lon, lat: dest.lat, type: "break" },
    ],
    costing: "auto",
    costing_options: {
      auto: { maneuver_penalty: 3, use_highways: 0.85, use_living_streets: 0.2 },
    },
    units,
    alternatives: true,
    directions_options: { units, language: "en-US" },
    id: "slide-fast",
  };
  return fetchJson(`${VALHALLA_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 12000);
}

export async function requestTraceAttributes(
  shape: string,
  units: "miles" | "kilometers" = "miles"
): Promise<TraceAttributes> {
  const body = {
    encoded_polyline: shape,
    shape_match: "edge_walk",
    costing: "auto",
    units,
    filters: {
      attributes: [
        "edge.length",
        "edge.speed",
        "edge.speed_limit",
        "edge.free_flow_speed",
        "edge.road_class",
        "edge.use",
        "edge.surface",
        "edge.names",
        "edge.lane_count",
        "edge.traffic_signal",
        "edge.weighted_grade",
        "edge.begin_heading",
        "edge.end_heading",
        "edge.way_id",
      ],
      action: "include",
    },
  };

  const res = await fetch(`${VALHALLA_URL}/trace_attributes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { edges: [] };
  }
  return res.json();
}

export function collectTrips(response: RouteResponse): ValhallaTrip[] {
  const trips: ValhallaTrip[] = [];
  if (response.trip) trips.push(response.trip);
  for (const alt of response.alternatives ?? []) {
    if (alt.trip) trips.push(alt.trip);
  }
  return trips;
}

/** The trip's full encoded shape. Slide plans two-point trips, so this is a single leg. */
export function tripShape(trip: ValhallaTrip): string {
  return trip.legs.map((l) => l.shape).join("");
}

/**
 * True when two trips are the same line. Valhalla can answer a second costing
 * pass with the identical geometry, and showing the driver "Slide" and "Faster"
 * as the same road is worse than showing one option.
 */
export function sameTrip(a: ValhallaTrip, b: ValhallaTrip): boolean {
  if (tripShape(a) === tripShape(b)) return true;
  const dt = Math.abs(a.summary.time - b.summary.time);
  const dl = Math.abs(a.summary.length - b.summary.length);
  return dt < 25 && dl < 0.06;
}
