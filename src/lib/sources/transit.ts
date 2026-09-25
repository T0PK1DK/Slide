import type { RadarItem } from "../reports";
import type { TransitVehicle } from "./gtfsrt";

/**
 * Which live transit feeds to read. Set as one Cloudflare Pages *secret*,
 * TRANSIT_FEEDS, holding a JSON array (so any API key stays server-side):
 *   [{"agency":"Miami-Dade Transit","mode":"bus","url":"https://…/vehiclepositions","header":"x-api-key","key":"…"},
 *    {"agency":"Tri-Rail","mode":"rail","url":"https://…"}]
 * Each agency publishes its GTFS-realtime VehiclePositions URL on its developer
 * page (some need a free key). Nothing is hard-coded, so a wrong or retired URL
 * just drops that agency instead of breaking the radar.
 */
export type TransitFeed = { agency: string; mode: "bus" | "rail"; url: string; header?: string; key?: string };

/** Pure: parse and validate TRANSIT_FEEDS. Bad entries are skipped, never thrown. */
export function parseFeeds(raw: string | undefined): TransitFeed[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.flatMap((f): TransitFeed[] => {
    if (!f || typeof f !== "object") return [];
    const o = f as Record<string, unknown>;
    if (typeof o.url !== "string" || !/^https:\/\//.test(o.url) || typeof o.agency !== "string") return [];
    return [{
      agency: o.agency.slice(0, 40),
      mode: o.mode === "rail" ? "rail" : "bus",
      url: o.url,
      header: typeof o.header === "string" ? o.header : undefined,
      key: typeof o.key === "string" ? o.key : undefined,
    }];
  });
}

/** Pure: a vehicle older than this (seconds) is dropped rather than shown as live. */
export const STALE_SEC = 180;

/** Pure: decoded vehicles → radar items, dropping stale positions. */
export function vehiclesToItems(vehicles: TransitVehicle[], feed: TransitFeed, nowSec = Date.now() / 1000): RadarItem[] {
  return vehicles.flatMap((v): RadarItem[] => {
    if (v.timestamp !== null && nowSec - v.timestamp > STALE_SEC) return [];
    const route = v.routeId ?? v.label;
    const noun = feed.mode === "rail" ? "Train" : "Bus";
    const age = v.timestamp !== null ? Math.max(0, Math.round(nowSec - v.timestamp)) : null;
    return [{
      id: `tr-${feed.agency}-${v.id}`,
      source: "transit",
      kind: feed.mode,
      lat: v.lat,
      lon: v.lon,
      title: route ? `${noun} ${route}` : noun,
      detail: `${feed.agency} · live${age !== null ? ` · ${age} s ago` : ""}`,
      createdAt: v.timestamp !== null ? v.timestamp * 1000 : Date.now(),
      confirms: 0,
      reportId: null,
    }];
  });
}
