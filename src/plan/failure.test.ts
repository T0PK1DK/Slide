import { describe, expect, it } from "vitest";
import { classifyFailure, HttpError } from "./failure";

describe("classifyFailure", () => {
  it("says offline first, whatever the error", () => {
    expect(classifyFailure(new TypeError("Failed to fetch"), false, "route").kind).toBe("offline");
    expect(classifyFailure(new HttpError(442, 442, "No path could be found for input"), false, "search").title).toBe("You're offline");
  });
  it("tells no-route apart from a server problem", () => {
    expect(classifyFailure(new HttpError(400, 442, "No path could be found for input"), true, "route").kind).toBe("no-route");
    expect(classifyFailure(new HttpError(400, 171, "No suitable edges near location"), true, "route").kind).toBe("no-route");
    expect(classifyFailure(new Error("No routes returned."), true, "route").kind).toBe("no-route");
    expect(classifyFailure(new HttpError(400, 442, "No path"), true, "search").kind).toBe("unreachable");
  });
  it("rate limits and drops", () => {
    expect(classifyFailure(new HttpError(429, null, ""), true, "route")).toMatchObject({ kind: "busy", title: "The free routing server is busy" });
    expect(classifyFailure(new DOMException("aborted", "AbortError"), true, "search")).toMatchObject({ kind: "unreachable", title: "Can't reach search" });
    expect(classifyFailure(new HttpError(502, null, ""), true, "route").kind).toBe("unreachable");
  });
});

import { warmUrls } from "../map/warm";
describe("warmUrls", () => {
  const style = { sprite: "https://t.example/sprites/ofm", glyphs: "https://t.example/fonts/{fontstack}/{range}.pbf",
    layers: [{ layout: { "text-font": ["Noto Sans Regular"] } }, { layout: { "text-font": ["Noto Sans Regular"] } }, { layout: { "text-font": ["Noto Sans Bold"] } }, { layout: {} }] };
  it("picks the sprite for the pixel ratio and the most used font's first range", () => {
    expect(warmUrls(style, 3)).toEqual(["https://t.example/sprites/ofm@2x.json", "https://t.example/sprites/ofm@2x.png", "https://t.example/fonts/Noto%20Sans%20Regular/0-255.pbf"]);
    expect(warmUrls(style, 1)[0]).toBe("https://t.example/sprites/ofm.json");
  });
  it("skips what the style doesn't name", () => {
    expect(warmUrls({}, 2)).toEqual([]);
  });
});
