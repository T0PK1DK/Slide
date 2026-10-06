import { describe, expect, it } from "vitest";
import { arrivalTarget, leaveByCopy, LEAVE_BUFFER_SEC } from "./leaveby";
import { leaveByForTarget } from "../lib/smooth";

describe("arrivalTarget", () => {
  const now = new Date("2026-10-04T15:00:00");
  it("uses today when the clock is still ahead", () => {
    const t = arrivalTarget("17:30", now)!;
    expect(t.getHours()).toBe(17);
    expect(t.getDate()).toBe(4);
  });
  it("rolls to tomorrow when that time already passed", () => {
    const t = arrivalTarget("14:00", now)!;
    expect(t.getDate()).toBe(5);
    expect(t.getHours()).toBe(14);
  });
  it("rejects junk", () => {
    expect(arrivalTarget("25:00", now)).toBeNull();
    expect(arrivalTarget("", now)).toBeNull();
  });
});

describe("leaveByCopy", () => {
  const now = new Date("2026-10-04T12:00:00");
  const target = new Date("2026-10-04T13:00:00");

  it("uses leaveByForTarget with the 3 min buffer", () => {
    const r = leaveByCopy(15 * 60, target, now);
    expect(r.depart).toEqual(leaveByForTarget(15 * 60, target, LEAVE_BUFFER_SEC));
    expect(r.late).toBe(false);
    expect(r.headline).toMatch(/^Leave by /);
    expect(r.note).toContain("Typical 15 min");
    expect(r.note).toContain("3 min buffer");
    expect(r.note).toContain("no live traffic");
    expect(r.note).not.toMatch(/faster|speed up/i);
  });

  it("says leave now when the typical start is already past", () => {
    const r = leaveByCopy(70 * 60, target, now);
    expect(r.late).toBe(true);
    expect(r.headline).toMatch(/Leave now/);
  });

  it("mentions real incidents only when the count is > 0", () => {
    expect(leaveByCopy(600, target, now, null).note).not.toContain("incident");
    expect(leaveByCopy(600, target, now, 0).note).not.toContain("incident");
    expect(leaveByCopy(600, target, now, 2).note).toContain("2 official incidents near you (not added to the time)");
  });
});
