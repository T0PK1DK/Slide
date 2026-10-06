/**
 * Route brain: the one place Slide decides the route line and the ETA.
 *
 * Before this, three sources wrote the time straight into the HUD — Valhalla's
 * typical time, TomTom Routing (traffic=true) and the TomTom flow-sample
 * fallback — and each refresh could land on a different one, so the minutes
 * jumped around. Now every source *offers* a whole-trip duration here, the
 * brain picks one with fixed rules, and every screen (review sheet, route
 * chip, dash, drive bar, arrival clock, trip sheet, leave-by) reads
 * `snapshot()`.
 *
 * Rules:
 * - Geometry: the chosen Valhalla line. It only changes through `setRoute()`
 *   (picking another line, or an accepted reroute). TomTom never redraws it.
 * - ETA: the freshest traffic-aware whole-trip time for *this* line
 *   (TomTom Routing > flow samples > Valhalla typical). A lower-ranked source
 *   can't replace a higher one until the higher one is stale (5 min), so it
 *   never flip-flops between sources.
 * - Smoothing: a new measurement only moves the shown number when it differs
 *   by ≥ 45 s and ≥ 3 %, and at most once every 20 s. The first live number for
 *   a line lands at once (that's the review screen filling in).
 * - Failure: a failed or over-quota TomTom call changes nothing; the last
 *   accepted number holds (no jump back to typical). Only an explicit
 *   "traffic off" returns to the Valhalla baseline.
 * - Progress: remaining time = committed whole-trip time × remaining share of
 *   this one line, so the countdown never switches source mid-drive.
 */

import { haversineMeters } from "./polyline";

export type EtaSource = "valhalla" | "flow" | "tomtom";

const RANK: Record<EtaSource, number> = { valhalla: 0, flow: 1, tomtom: 2 };

export type BrainRoute = {
  /** Stable key for this exact line (see `routeKey`). */
  key: string;
  /** Valhalla distance (miles). */
  distanceMi: number;
  /** Valhalla typical whole-trip time (seconds). */
  baselineSec: number;
  /** Line geometry [lon, lat]. Progress is measured along it. */
  coords?: Array<[number, number]>;
};

export type EtaOffer = {
  routeKey: string;
  source: Exclude<EtaSource, "valhalla">;
  /** Traffic-aware whole-trip seconds for the same line. */
  totalSec: number;
};

export type EtaSnapshot = {
  routeKey: string | null;
  coords: ReadonlyArray<[number, number]>;
  distanceMi: number;
  baselineSec: number;
  /** Committed whole-trip seconds (what the review sheet shows). */
  totalSec: number;
  /** totalSec − baseline, never negative. For "+N min" copy. */
  delaySec: number;
  /** Remaining seconds, scaled by progress along this line. */
  remainingSec: number;
  remainingMi: number;
  /** 0–1 along the line. */
  progress: number;
  /** Epoch ms of the expected arrival (now + remaining). */
  arrivalAt: number;
  /** Source behind the committed number. */
  source: EtaSource;
  /** Source is live traffic and still fresh. Drives the small "live traffic" badge. */
  live: boolean;
  /** When the shown number last changed (epoch ms). */
  updatedAt: number;
  /** When the current source last sent an accepted measurement (epoch ms). */
  measuredAt: number;
};

export type BrainOptions = {
  now?: () => number;
  /** Ignore changes smaller than this many seconds… */
  minChangeSec?: number;
  /** …or smaller than this share of the current time. Both must be exceeded. */
  minChangePct?: number;
  /** Shortest gap between two shown-number changes. */
  minIntervalMs?: number;
  /** A live measurement older than this no longer blocks lower sources or shows the badge. */
  staleMs?: number;
};

export const BRAIN_DEFAULTS = {
  minChangeSec: 45,
  minChangePct: 0.03,
  minIntervalMs: 20_000,
  staleMs: 5 * 60_000,
} as const;

/** Small GPS snaps backwards (overlapping segments, jitter) under this are ignored. */
const BACKTRACK_MI = 0.2;

/** Key for one exact line: Valhalla ids repeat across plans, so add shape facts. */
export function routeKey(id: string, coords: ReadonlyArray<[number, number]>, distanceMi: number): string {
  if (!coords.length) return `${id}:empty`;
  const a = coords[0];
  const b = coords[coords.length - 1];
  return `${id}:${coords.length}:${distanceMi.toFixed(3)}:${a[0].toFixed(5)},${a[1].toFixed(5)}:${b[0].toFixed(5)},${b[1].toFixed(5)}`;
}

function lineMiles(coords: ReadonlyArray<[number, number]>): number {
  let mi = 0;
  for (let i = 1; i < coords.length; i++) {
    mi += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]) / 1609.344;
  }
  return mi;
}

/**
 * Turn a TomTom Routing answer into a whole-trip time for our line. TomTom
 * reconstructs the line from our sampled points, so its length should match
 * Valhalla's. When it does, use TomTom's travel time (scaled to our length);
 * when it doesn't (it took a different road), keep our baseline and add only
 * TomTom's measured delay.
 */
export function tomtomTotalSec(input: {
  baselineSec: number;
  distanceMi: number;
  travelTimeSec: number;
  trafficDelaySec: number;
  lengthMeters?: number | null;
}): number | null {
  const { baselineSec, distanceMi, travelTimeSec, trafficDelaySec } = input;
  if (!Number.isFinite(travelTimeSec) || travelTimeSec <= 0) return null;
  const ttMi = (input.lengthMeters ?? 0) / 1609.344;
  if (ttMi > 0 && distanceMi > 0 && Math.abs(ttMi - distanceMi) / distanceMi <= 0.12) {
    return Math.round(travelTimeSec * (distanceMi / ttMi));
  }
  if (!Number.isFinite(baselineSec) || baselineSec <= 0) return null;
  return Math.round(baselineSec + Math.max(0, Number.isFinite(trafficDelaySec) ? trafficDelaySec : 0));
}

export class RouteBrain {
  private readonly now: () => number;
  private readonly minChangeSec: number;
  private readonly minChangePct: number;
  private readonly minIntervalMs: number;
  private readonly staleMs: number;

  private key: string | null = null;
  private coords: Array<[number, number]> = [];
  private coordsMi = 0;
  private distanceMi = 0;
  private baselineSec = 0;
  private totalSec = 0;
  private source: EtaSource = "valhalla";
  private measuredAt = 0;
  private updatedAt = 0;
  private alongMi = 0;
  /** A measurement above threshold that arrived inside the rate-limit window. */
  private pending: { totalSec: number; at: number } | null = null;
  private listeners = new Set<(s: EtaSnapshot) => void>();

  constructor(opts: BrainOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.minChangeSec = opts.minChangeSec ?? BRAIN_DEFAULTS.minChangeSec;
    this.minChangePct = opts.minChangePct ?? BRAIN_DEFAULTS.minChangePct;
    this.minIntervalMs = opts.minIntervalMs ?? BRAIN_DEFAULTS.minIntervalMs;
    this.staleMs = opts.staleMs ?? BRAIN_DEFAULTS.staleMs;
  }

  /** The line currently driving the ETA, or null. */
  routeKey(): string | null {
    return this.key;
  }

  /**
   * Pick a line. Same key → no-op (keeps any live number). New key → the
   * Valhalla baseline until a traffic source measures this line.
   * Returns true when the line changed.
   */
  setRoute(r: BrainRoute | null): boolean {
    if (!r || !Number.isFinite(r.baselineSec) || r.baselineSec <= 0) {
      if (this.key === null) return false;
      this.reset();
      this.emit();
      return true;
    }
    if (r.key === this.key) return false;
    this.reset();
    this.key = r.key;
    this.coords = r.coords ? [...r.coords] : [];
    this.coordsMi = this.coords.length > 1 ? lineMiles(this.coords) : 0;
    this.distanceMi = Math.max(0, r.distanceMi);
    this.baselineSec = r.baselineSec;
    this.totalSec = r.baselineSec;
    this.updatedAt = this.now();
    this.emit();
    return true;
  }

  /**
   * A source measured the whole trip on this line. Returns true when the
   * shown number changed.
   */
  offer(o: EtaOffer): boolean {
    if (!this.key || o.routeKey !== this.key) return false;
    if (!Number.isFinite(o.totalSec) || o.totalSec <= 0) return false;
    // Sanity: a result wildly off the baseline is a different road, not traffic.
    if (o.totalSec < this.baselineSec * 0.5 || o.totalSec > this.baselineSec * 3 + 600) return false;
    const now = this.now();
    const fresh = this.source !== "valhalla" && now - this.measuredAt < this.staleMs;
    if (fresh && RANK[o.source] < RANK[this.source]) return false; // never step down while the better source is fresh
    const firstLive = this.source === "valhalla";
    this.source = o.source;
    this.measuredAt = now;
    const target = Math.round(o.totalSec);
    if (!this.beyondThreshold(target)) {
      this.pending = null;
      this.emit(); // source / freshness changed even if the minutes didn't
      return false;
    }
    if (firstLive || now - this.updatedAt >= this.minIntervalMs) {
      this.commit(target, now);
      return true;
    }
    this.pending = { totalSec: target, at: now };
    this.emit();
    return false;
  }

  /**
   * TomTom (or flow) failed / over quota / timed out. Nothing visible changes:
   * the last accepted number holds and simply ages out of "live".
   */
  fail(routeKey: string): void {
    if (routeKey !== this.key) return;
    this.pending = null;
  }

  /** Driver turned traffic off: back to the Valhalla baseline (their choice, one change). */
  dropLive(): void {
    if (!this.key) return;
    this.pending = null;
    this.source = "valhalla";
    this.measuredAt = 0;
    if (this.totalSec !== this.baselineSec) {
      this.totalSec = this.baselineSec;
      this.updatedAt = this.now();
    }
    this.emit();
  }

  /** Miles along the chosen line (from the GPS snap). */
  setProgress(alongMi: number): void {
    if (!Number.isFinite(alongMi)) return;
    const mi = Math.max(0, alongMi);
    if (mi < this.alongMi && this.alongMi - mi < BACKTRACK_MI) return;
    this.alongMi = mi;
  }

  /** New drive on the same line: start the countdown from the top. */
  resetProgress(): void {
    this.alongMi = 0;
  }

  /** Apply a rate-limited pending change once its window has passed. Call from the HUD loop. */
  tick(): boolean {
    if (!this.pending) return false;
    const now = this.now();
    if (now - this.updatedAt < this.minIntervalMs) return false;
    const p = this.pending;
    this.pending = null;
    if (!this.beyondThreshold(p.totalSec)) return false;
    this.commit(p.totalSec, now);
    return true;
  }

  snapshot(): EtaSnapshot {
    const now = this.now();
    const lineMi = this.coordsMi > 0 ? this.coordsMi : this.distanceMi;
    const progress = lineMi > 0 ? Math.min(1, Math.max(0, this.alongMi / lineMi)) : 0;
    const remainingSec = this.key ? this.totalSec * (1 - progress) : 0;
    return {
      routeKey: this.key,
      coords: this.coords,
      distanceMi: this.distanceMi,
      baselineSec: this.baselineSec,
      totalSec: this.totalSec,
      delaySec: Math.max(0, this.totalSec - this.baselineSec),
      remainingSec,
      remainingMi: this.distanceMi * (1 - progress),
      progress,
      arrivalAt: now + remainingSec * 1000,
      source: this.source,
      live: this.source !== "valhalla" && now - this.measuredAt < this.staleMs,
      updatedAt: this.updatedAt,
      measuredAt: this.measuredAt,
    };
  }

  subscribe(fn: (s: EtaSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private beyondThreshold(target: number): boolean {
    const diff = Math.abs(target - this.totalSec);
    return diff >= this.minChangeSec && diff >= this.totalSec * this.minChangePct;
  }

  private commit(totalSec: number, at: number) {
    this.totalSec = totalSec;
    this.updatedAt = at;
    this.pending = null;
    this.emit();
  }

  private reset() {
    this.key = null;
    this.coords = [];
    this.coordsMi = 0;
    this.distanceMi = 0;
    this.baselineSec = 0;
    this.totalSec = 0;
    this.source = "valhalla";
    this.measuredAt = 0;
    this.updatedAt = 0;
    this.alongMi = 0;
    this.pending = null;
  }

  private emit() {
    if (!this.listeners.size) return;
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }
}

/** Footnote under the review ETA. Live copy comes from the brain; otherwise the traffic layer's status line. */
export function etaNoteFor(s: EtaSnapshot, fallback: string, attribution = "© TomTom"): string {
  if (!s.routeKey) return fallback;
  if (s.live) {
    const plus = s.delaySec >= 45 ? ` · +${Math.max(1, Math.round(s.delaySec / 60))} min` : "";
    return s.source === "tomtom" ? `Live traffic${plus} · ${attribution}` : `Live speeds${plus}`;
  }
  if (s.source !== "valhalla") return "Recent traffic · refreshing";
  return fallback;
}

/**
 * Translate one traffic-layer measurement (src/lib/traffic.ts RouteTraffic)
 * into a brain offer. TomTom Routing → its travel time for our line; flow
 * samples → Valhalla baseline + sampled delay. Null when it carries nothing usable.
 */
export function offerFromTraffic(
  rt: { source?: "routing" | "flow"; delaySec: number; travelTimeSec?: number; lengthMeters?: number } | null,
  key: string,
  baselineSec: number,
  distanceMi: number,
): EtaOffer | null {
  if (!rt || !key) return null;
  if (rt.source === "routing" && rt.travelTimeSec !== undefined) {
    const totalSec = tomtomTotalSec({ baselineSec, distanceMi, travelTimeSec: rt.travelTimeSec, trafficDelaySec: rt.delaySec, lengthMeters: rt.lengthMeters });
    return totalSec === null ? null : { routeKey: key, source: "tomtom", totalSec };
  }
  if (!Number.isFinite(rt.delaySec) || !(baselineSec > 0)) return null;
  return { routeKey: key, source: "flow", totalSec: Math.round(baselineSec + Math.max(0, rt.delaySec)) };
}
