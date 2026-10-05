import type { TelemetrySample } from "./smoothScore";

/** Test/helper: a constant-speed run. Distance is exact via speed × time unless coords are set. */
export function cruise(opts: {
  mph: number;
  posted?: number | null;
  miles: number;
  heading?: number | null;
  startAt?: number;
  lon?: number;
  lat?: number;
}): TelemetrySample[] {
  const dt = 1;
  const n = Math.max(3, Math.round((opts.miles / opts.mph) * 3600 / dt) + 1);
  const start = opts.startAt ?? Date.UTC(2026, 5, 1, 15, 0, 0);
  const out: TelemetrySample[] = [];
  const lonPerMile = opts.lat != null ? 1 / (69.172 * Math.cos((opts.lat * Math.PI) / 180)) : 0;
  for (let i = 0; i < n; i++) {
    const along = opts.lon != null && opts.lat != null ? (i / Math.max(1, n - 1)) * 0.2 : 0;
    out.push({
      at: start + i * dt * 1000,
      speedMph: opts.mph,
      headingDeg: opts.heading === undefined ? 90 : opts.heading,
      postedMph: opts.posted === undefined ? 55 : opts.posted,
      lon: opts.lon != null ? opts.lon + along * lonPerMile : undefined,
      lat: opts.lat,
    });
  }
  return out;
}
