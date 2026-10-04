import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_ENTRY_KEYS,
  addWeekTrip,
  createLeaderboard,
  emptyBoard,
  entryFromRollup,
  migrateBoard,
  rankWeek,
  startOfMonday,
  useLeaderboard,
  weekBounds,
  weekIdAt,
  type LeaderboardEntry,
} from "./leaderboard";
import { memoryStore } from "./progress";

const FORBIDDEN = [
  "address",
  "dest",
  "destlabel",
  "lat",
  "lon",
  "latitude",
  "longitude",
  "coord",
  "coords",
  "coordinates",
  "location",
  "place",
  "street",
  "startedat",
  "endedat",
  "time",
  "clock",
  "when",
  "map",
  "tile",
  "route",
];

function keysOf(v: unknown, path = ""): string[] {
  if (!v || typeof v !== "object") return path ? [path] : [];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, val]) => {
    const next = path ? `${path}.${k}` : k;
    return typeof val === "object" && val !== null ? [next, ...keysOf(val, next)] : [next];
  });
}

const monday = new Date(2026, 5, 1, 9, 0, 0); // 1 Jun 2026 is a Monday
const sunday = new Date(2026, 5, 7, 21, 30, 0);
const prevSunday = new Date(2026, 4, 31, 18, 0, 0);
const nextMonday = new Date(2026, 5, 8, 0, 0, 0);

describe("weekly bucketing (Mon–Sun local)", () => {
  it("puts Monday and the following Sunday in the same week", () => {
    expect(monday.getDay()).toBe(1);
    expect(sunday.getDay()).toBe(0);
    const id = weekIdAt(monday.getTime());
    expect(weekIdAt(sunday.getTime())).toBe(id);
    expect(weekIdAt(prevSunday.getTime())).not.toBe(id);
    expect(weekIdAt(nextMonday.getTime())).not.toBe(id);
  });

  it("starts the bucket at local Monday 00:00 and ends at the next Monday", () => {
    const start = startOfMonday(sunday.getTime());
    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    const id = weekIdAt(monday.getTime());
    const b = weekBounds(id);
    expect(b).not.toBeNull();
    expect(b!.startsAt).toBe(start.getTime());
    expect(b!.endsAt - b!.startsAt).toBe(7 * 86400000);
    expect(monday.getTime()).toBeGreaterThanOrEqual(b!.startsAt);
    expect(sunday.getTime()).toBeLessThan(b!.endsAt);
    expect(nextMonday.getTime()).toBe(b!.endsAt);
  });

  it("uses a stable YYYY-Www id", () => {
    expect(weekIdAt(monday.getTime())).toMatch(/^\d{4}-W\d{2}$/);
    expect(weekBounds("nope")).toBeNull();
    expect(weekBounds("2026-W00")).toBeNull();
  });
});

describe("leaderboard entry privacy", () => {
  it("only has handle, weekId, smoothAvg, trips, smoothMiles", () => {
    const entry = entryFromRollup("nova", "2026-W23", { trips: 2, scoreSum: 160, smoothMiles: 5 });
    expect(Object.keys(entry).sort()).toEqual([...LEADERBOARD_ENTRY_KEYS].sort());
    const names = keysOf(entry).map((k) => k.toLowerCase());
    for (const bad of FORBIDDEN) {
      expect(names.some((k) => k === bad || k.endsWith(`.${bad}`))).toBe(false);
    }
    expect(JSON.stringify(entry)).not.toMatch(/lat|lon|address|Ocean|Brickell|-80\./i);
  });
});

describe("rankWeek", () => {
  const week = "2026-W23";
  const row = (handle: string, avg: number, miles = 1, id = week): LeaderboardEntry => ({
    handle,
    weekId: id,
    smoothAvg: avg,
    trips: 1,
    smoothMiles: miles,
  });

  it("ranks higher smooth average first and ignores other weeks", () => {
    const ranked = rankWeek(
      [row("b", 70), row("a", 90), row("c", 80, 1, "2026-W22"), row("d", 90, 4)],
      week
    );
    expect(ranked.map((r) => r.handle)).toEqual(["d", "a", "b"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("does not invent friends or rank a null average", () => {
    expect(rankWeek([], week)).toEqual([]);
    expect(rankWeek([{ handle: "me", weekId: week, smoothAvg: null, trips: 0, smoothMiles: 0 }], week)).toEqual([]);
  });

  it("breaks remaining ties by handle, deterministically", () => {
    const ranked = rankWeek([row("zeta", 80), row("alpha", 80)], week);
    expect(ranked.map((r) => r.handle)).toEqual(["alpha", "zeta"]);
  });
});

describe("opt-in store", () => {
  it("defaults OFF and does not record until the driver opts in", () => {
    const board = createLeaderboard(memoryStore());
    expect(board.isOptedIn()).toBe(false);
    expect(emptyBoard().optIn).toBe(false);
    board.recordTrip(80, 2, monday.getTime());
    expect(board.myWeek("me", monday.getTime())).toBeNull();
    expect(board.shareableEntry("me", monday.getTime())).toBeNull();
    board.setOptIn(true);
    board.recordTrip(80, 2, monday.getTime());
    expect(board.myWeek("me", monday.getTime())?.smoothAvg).toBe(80);
    expect(board.shareableEntry("me", monday.getTime())?.handle).toBe("me");
  });

  it("persists opt-in and weekly rollups on this device only", () => {
    const store = memoryStore();
    const a = createLeaderboard(store);
    a.setOptIn(true);
    a.recordTrip(70, 1, monday.getTime());
    a.recordTrip(90, 3, sunday.getTime());
    const b = createLeaderboard(store);
    expect(b.isOptedIn()).toBe(true);
    const mine = b.myWeek("tag", sunday.getTime());
    expect(mine?.trips).toBe(2);
    expect(mine?.smoothAvg).toBe(80);
    expect(mine?.smoothMiles).toBe(4);
    expect(b.myWeek("tag", nextMonday.getTime())).toBeNull();
  });

  it("migrates junk without turning opt-in on", () => {
    expect(migrateBoard(null).optIn).toBe(false);
    expect(migrateBoard({ optIn: "yes", weeks: { bad: 1 } }).weeks).toEqual({});
    expect(migrateBoard({ optIn: true }).optIn).toBe(true);
  });

  it("useLeaderboard with a store does not invent a friend list", () => {
    const board = useLeaderboard({ store: memoryStore() });
    expect(board.rank([])).toEqual([]);
    expect(addWeekTrip({ trips: 0, scoreSum: 0, smoothMiles: 0 }, 50, 2).trips).toBe(1);
  });
});
