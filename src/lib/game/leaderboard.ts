/**
 * Opt-in weekly smooth-score board. Local model only — no server, no fake friends.
 * Week is Monday 00:00 – Sunday 23:59:59.999 in the device's local timezone.
 * Default is OFF. Ranking is a pure function of the entries you pass in.
 */
import type { KVStore } from "./progress";
import { memoryStore } from "./progress";

export const BOARD_KEY = "slide.game.board.v1";

/** Fields allowed on a board row. Location and trip times must never appear. */
export const LEADERBOARD_ENTRY_KEYS = ["handle", "weekId", "smoothAvg", "trips", "smoothMiles"] as const;

export type LeaderboardEntry = {
  /** Display handle only (@name or driver tag). Not an address. */
  handle: string;
  /** Local ISO-like week, e.g. "2026-W23". Monday-start. */
  weekId: string;
  /** Mean telemetry smooth score for the week, or null with no scored trips. */
  smoothAvg: number | null;
  trips: number;
  smoothMiles: number;
};

export type RankedEntry = LeaderboardEntry & { rank: number };

export type WeekBucket = {
  weekId: string;
  /** Monday 00:00:00.000 local. */
  startsAt: number;
  /** Next Monday 00:00:00.000 local (exclusive end). */
  endsAt: number;
};

export type WeekRollup = { trips: number; scoreSum: number; smoothMiles: number };

export type LeaderboardState = {
  /** Sharing this week's aggregate. Defaults OFF. */
  optIn: boolean;
  weeks: Record<string, WeekRollup>;
};

const DAY = 86_400_000;

export function startOfMonday(at: number): Date {
  const d = new Date(at);
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** ISO week-year + week number from a Monday (local). */
export function weekIdAt(at = Date.now()): string {
  const monday = startOfMonday(at);
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1 = startOfMonday(jan4.getTime());
  const week = Math.round((monday.getTime() - week1.getTime()) / (7 * DAY)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekBounds(weekId: string): WeekBucket | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const week1 = startOfMonday(new Date(year, 0, 4).getTime());
  const monday = new Date(week1.getTime() + (week - 1) * 7 * DAY);
  return { weekId, startsAt: monday.getTime(), endsAt: monday.getTime() + 7 * DAY };
}

export function emptyBoard(): LeaderboardState {
  return { optIn: false, weeks: {} };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function migrateBoard(saved: unknown): LeaderboardState {
  const out = emptyBoard();
  if (!isRecord(saved)) return out;
  out.optIn = saved.optIn === true;
  if (isRecord(saved.weeks)) {
    for (const [id, raw] of Object.entries(saved.weeks)) {
      if (!/^\d{4}-W\d{2}$/.test(id) || !isRecord(raw)) continue;
      const trips = typeof raw.trips === "number" && raw.trips >= 0 ? raw.trips : 0;
      const scoreSum = typeof raw.scoreSum === "number" && raw.scoreSum >= 0 ? raw.scoreSum : 0;
      const smoothMiles = typeof raw.smoothMiles === "number" && raw.smoothMiles >= 0 ? raw.smoothMiles : 0;
      out.weeks[id] = { trips, scoreSum, smoothMiles };
    }
  }
  return out;
}

export function addWeekTrip(week: WeekRollup, score: number, miles: number): WeekRollup {
  return {
    trips: week.trips + 1,
    scoreSum: week.scoreSum + score,
    smoothMiles: week.smoothMiles + Math.max(0, miles),
  };
}

export function entryFromRollup(handle: string, weekId: string, week: WeekRollup): LeaderboardEntry {
  return {
    handle,
    weekId,
    smoothAvg: week.trips ? week.scoreSum / week.trips : null,
    trips: week.trips,
    smoothMiles: week.smoothMiles,
  };
}

/**
 * Rank one week. Entries from other weeks are dropped. `smoothAvg === null`
 * is dropped (nothing real to rank). Sort: higher average, then more smooth
 * miles, then handle. Does not invent friends.
 */
export function rankWeek(entries: readonly LeaderboardEntry[], weekId: string): RankedEntry[] {
  const rows = entries.filter((e) => e.weekId === weekId && e.smoothAvg != null && e.handle.trim());
  const sorted = [...rows].sort((a, b) => {
    const av = (b.smoothAvg ?? 0) - (a.smoothAvg ?? 0);
    if (av !== 0) return av;
    if (b.smoothMiles !== a.smoothMiles) return b.smoothMiles - a.smoothMiles;
    return a.handle.localeCompare(b.handle);
  });
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

export type LeaderboardApi = {
  get(): LeaderboardState;
  isOptedIn(): boolean;
  setOptIn(on: boolean): void;
  recordTrip(score: number, miles: number, at?: number): void;
  /** On-device week for this phone. Always available; not a share. */
  myWeek(handle: string, at?: number): LeaderboardEntry | null;
  /** Same as myWeek, but null unless the driver opted in. */
  shareableEntry(handle: string, at?: number): LeaderboardEntry | null;
  weekId(at?: number): string;
  rank(entries: readonly LeaderboardEntry[], weekId?: string): RankedEntry[];
  reset(): void;
};

function defaultStore(): KVStore {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* blocked */
  }
  return memoryStore();
}

function readBoard(store: KVStore): LeaderboardState {
  try {
    const raw = store.getItem(BOARD_KEY);
    return raw ? migrateBoard(JSON.parse(raw)) : emptyBoard();
  } catch {
    return emptyBoard();
  }
}

function writeBoard(store: KVStore, state: LeaderboardState) {
  try {
    store.setItem(BOARD_KEY, JSON.stringify(state));
  } catch {
    /* private / full */
  }
}

export function createLeaderboard(store: KVStore = defaultStore()): LeaderboardApi {
  let state = readBoard(store);
  const persist = (next: LeaderboardState) => {
    state = next;
    writeBoard(store, next);
  };

  const weekOf = (at?: number) => weekIdAt(at ?? Date.now());

  const myWeek = (handle: string, at?: number): LeaderboardEntry | null => {
    const id = weekOf(at);
    const week = state.weeks[id];
    if (!week || !handle.trim()) return null;
    return entryFromRollup(handle.trim(), id, week);
  };

  return {
    get: () => ({ optIn: state.optIn, weeks: { ...state.weeks } }),
    isOptedIn: () => state.optIn,
    setOptIn(on) {
      persist({ ...state, optIn: on === true });
    },
    recordTrip(score, miles, at) {
      if (!state.optIn) return;
      if (!Number.isFinite(score) || score < 0) return;
      const id = weekOf(at);
      const prev = state.weeks[id] ?? { trips: 0, scoreSum: 0, smoothMiles: 0 };
      persist({ ...state, weeks: { ...state.weeks, [id]: addWeekTrip(prev, score, miles) } });
    },
    myWeek,
    shareableEntry(handle, at) {
      return state.optIn ? myWeek(handle, at) : null;
    },
    weekId: weekOf,
    rank(entries, weekId) {
      return rankWeek(entries, weekId ?? weekOf());
    },
    reset() {
      persist(emptyBoard());
    },
  };
}

let singleton: LeaderboardApi | null = null;

export function useLeaderboard(opts?: { store?: KVStore }): LeaderboardApi {
  if (opts?.store) return createLeaderboard(opts.store);
  return (singleton ??= createLeaderboard());
}
