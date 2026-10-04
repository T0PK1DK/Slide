import type { RadarItem, RadarKind } from "../reports";

/**
 * Miami-Dade Police traffic calls (traffic.mdpd.com/api/) → radar items. No
 * key; the browser can't call it (no CORS), so only the Pages Function does.
 * Rows: { createTime: "2026-10-04T10:01:17.000" (Miami local time), signal,
 * address, location, grid, latitude, longitude }. These are dispatched calls
 * (crashes, hit-and-runs, disabled vehicles), not police positions.
 */
export const MDPD_URL = "https://traffic.mdpd.com/api/";

/** Pure: a wall-clock time in America/New_York (no zone) → epoch ms. Handles EST/EDT. */
export function nyLocalToEpoch(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s.trim());
  if (!m) return NaN;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const offsetMin = (t: number) => {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
      .formatToParts(new Date(t)).find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
    const o = /GMT([+-]\d+)(?::(\d+))?/.exec(name);
    return o ? Number(o[1]) * 60 + Math.sign(Number(o[1])) * Number(o[2] ?? 0) : -300;
  };
  // Two passes so times near the DST switch land on the right offset.
  let t = asUtc - offsetMin(asUtc) * 60000;
  t = asUtc - offsetMin(t) * 60000;
  return t;
}

/** Pure: MDPD signal text → radar kind. */
export function mdpdKind(signal: string): RadarKind {
  const s = signal.toLowerCase();
  if (/accident|crash|hit and run/.test(s)) return "crash";
  if (/block|closed|closure/.test(s)) return "closure";
  return "hazard"; // disabled vehicle, signal out, debris…
}

/** "NW 135TH ST" → "NW 135th St": title case, but compass quadrants stay upper case. */
const title = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(Nw|Ne|Sw|Se)\b/g, (q) => q.toUpperCase());

/** Pure: one MDPD row → radar item, or null without a usable position. */
export function fromMdpd(r: Record<string, unknown>, nowMs = Date.now()): RadarItem | null {
  const lat = Number(r.latitude);
  const lon = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  const signal = String(r.signal ?? "").trim();
  const address = String(r.address ?? "").trim();
  const where = String(r.location ?? "").trim();
  const when = nyLocalToEpoch(String(r.createTime ?? ""));
  return {
    id: `mdpd-${String(r.createTime ?? "")}-${lat.toFixed(5)},${lon.toFixed(5)}`,
    source: "mdpd",
    kind: mdpdKind(signal),
    lat,
    lon,
    title: [signal ? title(signal) : "Traffic call", address && `at ${title(address)}`].filter(Boolean).join(" "),
    detail: `Miami-Dade Police · ${[where, "dispatched call"].filter(Boolean).join(" · ")}`,
    createdAt: Number.isFinite(when) ? when : nowMs,
    confirms: 0,
    reportId: null,
  };
}
