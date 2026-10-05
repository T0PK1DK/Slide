import { describe, expect, it } from "vitest";
import {
  TOMTOM_SEARCH_DAILY,
  TOMTOM_TOTAL_DAILY,
  canSpend,
  emptyBudget,
  memoryBudgetStore,
  remaining,
  reserve,
  spend,
  utcDay,
} from "./tomtom-budget";

describe("TomTom daily budget", () => {
  it("stops search near 1,500 and everything at 2,500", () => {
    const day = utcDay();
    expect(canSpend(emptyBudget(day), "search")).toBe(true);
    expect(canSpend(spend(emptyBudget(day), "search", TOMTOM_SEARCH_DAILY), "search")).toBe(false);
    expect(canSpend(spend(emptyBudget(day), "search", TOMTOM_SEARCH_DAILY), "route")).toBe(true);
    const full = spend(emptyBudget(day), "route", TOMTOM_TOTAL_DAILY);
    expect(canSpend(full, "route")).toBe(false);
    expect(remaining(spend(emptyBudget(day), "search", 10))).toEqual({
      search: TOMTOM_SEARCH_DAILY - 10,
      total: TOMTOM_TOTAL_DAILY - 10,
    });
  });

  it("reserve increments and refuses when spent", async () => {
    const store = memoryBudgetStore();
    const a = await reserve(store, "search", Date.parse("2026-10-05T12:00:00Z"));
    expect(a?.search).toBe(1);
    const spent = memoryBudgetStore(spend(emptyBudget("2026-10-05"), "search", TOMTOM_SEARCH_DAILY));
    await expect(reserve(spent, "search", Date.parse("2026-10-05T12:00:00Z"))).resolves.toBeNull();
  });
});
