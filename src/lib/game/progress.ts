/**
 * On-device game progress. localStorage only — no server calls.
 * `eraseDeviceData()` already wipes every `slide.*` key, including this one.
 */
import { haversineMeters } from "../polyline";
import {
  applyBadgeDeltas,
  badgesFromCounts,
  BADGE_BY_ID,
  CAUSEWAYS,
  emptyBadgeCounts,
  newlyEarned,
  tripBadgeDeltas,
  type BadgeCounts,
  type BadgeId,
  type BadgeTier,
} from "./badges";
import { scoreTripSmooth, type SmoothScore, type TelemetrySample } from "./smoothScore";
import { newlyUnlocked, unlockedLiveries, unlockedVehicles, isLiveryUnlocked, isVehicleUnlocked } from "./unlocks";
import { levelForXp, xpForTrip, xpToNextLevel } from "./xp";
import type { Livery, Vehicle } from "../vehicles";

export const GAME_KEY = "slide.game.v1";
const MAX_TRIP_IDS = 200;
const MIN_DRIVE_MI = 0.2;
const SAMPLE_GAP_MS = 700;
const MAX_SAMPLES = 8_000;

export type KVStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type GameProgress = {
  xp: number;
  level: number;
  trips: number;
  smoothMiles: number;
  totalMiles: number;
  streak: number;
  bestStreak: number;
  counts: BadgeCounts;
  badges: Partial<Record<BadgeId, BadgeTier>>;
  lastTripId: string | null;
  updatedAt: number;
};

export type ShareCardModel = {
  score: number | null;
  xp: number;
  miles: number;
  level: number;
  badge: { name: string; tier: BadgeTier } | null;
};

export type TripAward = {
  tripId: string;
  score: SmoothScore;
  xpEarned: number;
  xpTotal: number;
  level: number;
  leveledUp: boolean;
  badgesEarned: Array<{ id: BadgeId; name: string; tier: BadgeTier }>;
  unlocks: Array<{ type: "vehicle" | "livery"; id: string; name: string }>;
  shareCard: ShareCardModel;
  alreadyRecorded: boolean;
};

export type DriveInput = {
  tripId: string;
  startedAt: number;
  endedAt: number;
  samples?: TelemetrySample[];
  /** Real GPS miles from the drive log, when the caller has them. */
  distanceMi?: number;
};

export function emptyProgress(now = Date.now()): GameProgress {
  return {
    xp: 0,
    level: 1,
    trips: 0,
    smoothMiles: 0,
    totalMiles: 0,
    streak: 0,
    bestStreak: 0,
    counts: emptyBadgeCounts(),
    badges: {},
    lastTripId: null,
    updatedAt: now,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function migrateProgress(saved: unknown, now = Date.now()): GameProgress {
  const out = emptyProgress(now);
  if (!isRecord(saved)) return out;
  if (typeof saved.xp === "number" && Number.isFinite(saved.xp) && saved.xp >= 0) out.xp = Math.floor(saved.xp);
  out.level = levelForXp(out.xp);
  if (typeof saved.trips === "number" && saved.trips >= 0) out.trips = Math.floor(saved.trips);
  if (typeof saved.smoothMiles === "number" && saved.smoothMiles >= 0) out.smoothMiles = saved.smoothMiles;
  if (typeof saved.totalMiles === "number" && saved.totalMiles >= 0) out.totalMiles = saved.totalMiles;
  if (typeof saved.streak === "number" && saved.streak >= 0) out.streak = Math.floor(saved.streak);
  if (typeof saved.bestStreak === "number" && saved.bestStreak >= 0) out.bestStreak = Math.floor(saved.bestStreak);
  if (isRecord(saved.counts)) {
    for (const id of Object.keys(out.counts) as BadgeId[]) {
      const n = saved.counts[id];
      if (typeof n === "number" && n >= 0) out.counts[id] = n;
    }
  }
  out.badges = badgesFromCounts(out.counts);
  if (typeof saved.lastTripId === "string") out.lastTripId = saved.lastTripId;
  if (typeof saved.updatedAt === "number") out.updatedAt = saved.updatedAt;
  return out;
}

type Stored = GameProgress & { tripIds: string[] };

function readStored(store: KVStore): Stored {
  try {
    const raw = store.getItem(GAME_KEY);
    if (!raw) return { ...emptyProgress(), tripIds: [] };
    const parsed = JSON.parse(raw) as unknown;
    const progress = migrateProgress(parsed);
    const tripIds = isRecord(parsed) && Array.isArray(parsed.tripIds)
      ? parsed.tripIds.filter((id): id is string => typeof id === "string").slice(0, MAX_TRIP_IDS)
      : [];
    return { ...progress, tripIds };
  } catch {
    return { ...emptyProgress(), tripIds: [] };
  }
}

function writeStored(store: KVStore, data: Stored) {
  try {
    store.setItem(GAME_KEY, JSON.stringify(data));
  } catch {
    // Private mode or full storage: progress still works for this session.
  }
}

export function memoryStore(seed: Record<string, string> = {}): KVStore {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

function defaultStore(): KVStore {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* blocked */
  }
  return memoryStore();
}

function crossedCauseway(samples: readonly TelemetrySample[]): boolean {
  for (const s of samples) {
    if (s.lon == null || s.lat == null) continue;
    for (const c of CAUSEWAYS) {
      if (haversineMeters(s.lon, s.lat, c.lon, c.lat) <= c.radiusM) return true;
    }
  }
  return false;
}

function tripDistance(samples: readonly TelemetrySample[], given?: number): number {
  if (given != null && Number.isFinite(given) && given >= 0) return given;
  let mi = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a.lon == null || a.lat == null || b.lon == null || b.lat == null) continue;
    mi += haversineMeters(a.lon, a.lat, b.lon, b.lat) / 1609.344;
  }
  return mi;
}

function emptyAward(score: SmoothScore, distanceMi: number, before: GameProgress, tripId: string, already: boolean): TripAward {
  return {
    tripId,
    score,
    xpEarned: 0,
    xpTotal: before.xp,
    level: before.level,
    leveledUp: false,
    badgesEarned: [],
    unlocks: [],
    shareCard: {
      score: score.total,
      xp: 0,
      miles: Math.round(distanceMi * 100) / 100,
      level: before.level,
      badge: null,
    },
    alreadyRecorded: already,
  };
}

function previewAward(input: DriveInput, samples: TelemetrySample[], stored: Stored): TripAward {
  const score = scoreTripSmooth(samples);
  const distanceMi = tripDistance(samples, input.distanceMi);
  const already = stored.tripIds.includes(input.tripId);
  if (already || score.total == null || distanceMi < MIN_DRIVE_MI) {
    return emptyAward(score, distanceMi, stored, input.tripId, already);
  }

  const deltas = tripBadgeDeltas(stored.streak, {
    score,
    distanceMi,
    startedAt: input.startedAt,
    hasCoords: samples.some((s) => s.lon != null && s.lat != null),
    crossedCauseway: crossedCauseway(samples),
  });
  const counts = applyBadgeDeltas(stored.counts, deltas);
  const badges = badgesFromCounts(counts);
  const xpEarned = xpForTrip(distanceMi, score.total);
  const xp = stored.xp + xpEarned;
  const level = levelForXp(xp);
  const earned = newlyEarned(stored.badges, badges);
  const unlocks = newlyUnlocked(
    { level: stored.level, badges: stored.badges },
    { level, badges }
  );
  const topBadge = earned[earned.length - 1] ?? null;
  return {
    tripId: input.tripId,
    score,
    xpEarned,
    xpTotal: xp,
    level,
    leveledUp: level > stored.level,
    badgesEarned: earned,
    unlocks,
    shareCard: {
      score: score.total,
      xp: xpEarned,
      miles: Math.round(distanceMi * 100) / 100,
      level,
      badge: topBadge ? { name: BADGE_BY_ID[topBadge.id].name, tier: topBadge.tier } : null,
    },
    alreadyRecorded: false,
  };
}

export type GameApi = {
  get(): GameProgress;
  subscribe(listener: (p: GameProgress) => void): () => void;
  preview(input: DriveInput): TripAward;
  commit(input: DriveInput): TripAward;
  beginDrive(): void;
  recordSample(sample: TelemetrySample): void;
  samples(): TelemetrySample[];
  lastAward(): TripAward | null;
  canUseVehicle(id: string): boolean;
  canUseLivery(id: string): boolean;
  unlocked(): { vehicles: Vehicle[]; liveries: Livery[] };
  xpBar(): { level: number; into: number; need: number };
  reset(): void;
};

export function createGameProgress(store: KVStore = defaultStore()): GameApi {
  let cached = readStored(store);
  let buffer: TelemetrySample[] = [];
  let lastAwardValue: TripAward | null = null;
  const listeners = new Set<(p: GameProgress) => void>();

  const snapshot = (): GameProgress => ({
    xp: cached.xp,
    level: cached.level,
    trips: cached.trips,
    smoothMiles: cached.smoothMiles,
    totalMiles: cached.totalMiles,
    streak: cached.streak,
    bestStreak: cached.bestStreak,
    counts: { ...cached.counts },
    badges: { ...cached.badges },
    lastTripId: cached.lastTripId,
    updatedAt: cached.updatedAt,
  });

  const emit = () => {
    const p = snapshot();
    for (const fn of listeners) fn(p);
  };

  const persist = (next: Stored) => {
    cached = next;
    writeStored(store, next);
    emit();
  };

  const resolveSamples = (input: DriveInput): TelemetrySample[] =>
    input.samples ?? buffer;

  return {
    get: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    preview(input) {
      return previewAward(input, resolveSamples(input), cached);
    },
    commit(input) {
      const samples = resolveSamples(input);
      const award = previewAward(input, samples, cached);
      lastAwardValue = award;
      if (award.alreadyRecorded || award.score.total == null) {
        buffer = [];
        return award;
      }
      const distanceMi = award.shareCard.miles;
      if (distanceMi < MIN_DRIVE_MI) {
        buffer = [];
        return award;
      }
      const deltas = tripBadgeDeltas(cached.streak, {
        score: award.score,
        distanceMi,
        startedAt: input.startedAt,
        hasCoords: samples.some((s) => s.lon != null && s.lat != null),
        crossedCauseway: crossedCauseway(samples),
      });
      const counts = applyBadgeDeltas(cached.counts, deltas);
      const tripIds = [input.tripId, ...cached.tripIds.filter((id) => id !== input.tripId)].slice(0, MAX_TRIP_IDS);
      persist({
        xp: award.xpTotal,
        level: award.level,
        trips: cached.trips + 1,
        smoothMiles: cached.smoothMiles + distanceMi * ((award.score.total ?? 0) / 100),
        totalMiles: cached.totalMiles + distanceMi,
        streak: deltas["smooth-streak"] ?? 0,
        bestStreak: Math.max(cached.bestStreak, deltas["smooth-streak"] ?? 0),
        counts,
        badges: badgesFromCounts(counts),
        lastTripId: input.tripId,
        updatedAt: input.endedAt || Date.now(),
        tripIds,
      });
      buffer = [];
      return award;
    },
    beginDrive() {
      buffer = [];
    },
    recordSample(sample) {
      const last = buffer[buffer.length - 1];
      if (last && sample.at - last.at < SAMPLE_GAP_MS) {
        buffer[buffer.length - 1] = sample;
        return;
      }
      buffer.push(sample);
      if (buffer.length > MAX_SAMPLES) buffer.splice(0, buffer.length - MAX_SAMPLES);
    },
    samples: () => buffer.slice(),
    lastAward: () => lastAwardValue,
    canUseVehicle(id) {
      return isVehicleUnlocked(id, cached);
    },
    canUseLivery(id) {
      return isLiveryUnlocked(id, cached);
    },
    unlocked() {
      return { vehicles: unlockedVehicles(cached), liveries: unlockedLiveries(cached) };
    },
    xpBar() {
      return xpToNextLevel(cached.xp);
    },
    reset() {
      buffer = [];
      lastAwardValue = null;
      persist({ ...emptyProgress(), tripIds: [] });
    },
  };
}

let singleton: GameApi | null = null;

/**
 * Grim's slots (arrival XP/badge, share-card mount, 3D stage) should call this.
 * Same singleton across the app; pass `{ store }` only in tests.
 */
export function useGameProgress(opts?: { store?: KVStore }): GameApi {
  if (opts?.store) return createGameProgress(opts.store);
  return (singleton ??= createGameProgress());
}
