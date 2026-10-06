import { describe, expect, it } from "vitest";
import { buildLabel, canReloadNow, isOtherBuild } from "./update";

const local = { sha: "e5c5ff0", builtAt: "2026-10-06T12:40:00.000Z" };

describe("update check", () => {
  it("spots a different deploy", () => {
    expect(isOtherBuild({ sha: "abc1234", builtAt: "2026-10-06T15:00:00.000Z" }, local)).toBe(true);
    expect(isOtherBuild({ sha: "e5c5ff0", builtAt: "2026-10-06T15:00:00.000Z" }, local)).toBe(true); // rebuilt same commit
  });
  it("ignores the same build and junk", () => {
    expect(isOtherBuild({ ...local }, local)).toBe(false);
    expect(isOtherBuild(null, local)).toBe(false);
    expect(isOtherBuild({ sha: "<script>" }, local)).toBe(false);
    expect(isOtherBuild("e5c5ff0", local)).toBe(false);
    expect(isOtherBuild({ sha: "abc1234" }, { sha: "dev", builtAt: "" })).toBe(false);
  });
  it("never reloads mid-drive or on the arrival screen", () => {
    expect(canReloadNow("drive", true)).toBe(false);
    expect(canReloadNow("arrive", true)).toBe(false);
    expect(canReloadNow("review", true)).toBe(false);
    expect(canReloadNow("plan", false)).toBe(true);
  });
  it("labels the build with its short commit", () => {
    expect(buildLabel(local, "en-US")).toMatch(/^e5c5ff0 · Oct 6/);
    expect(buildLabel({ sha: "dev", builtAt: "" })).toBe("dev");
  });
});
