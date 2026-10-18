import { describe, expect, it } from "vitest";
import { LOOK_FIXTURES } from "../look/fixtures";
import { ghostCarHtml } from "./ghost-car";

describe("ghost car markers", () => {
  it("paints color, name tag, and heading arrow", () => {
    const html = ghostCarHtml(LOOK_FIXTURES.ghosts[0]!);
    expect(html).toContain("King");
    expect(html).toContain("#f0a04b");
    expect(html).toContain("rotate(42deg)");
    expect(html).toContain("look-ghost-arrow");
    expect(html).toContain("<svg");
  });

  it("empty-states a missing name", () => {
    const html = ghostCarHtml({ lat: 26, lon: -80, headingDeg: 10 });
    expect(html).toContain("Friend");
    expect(html).toContain("is-empty");
  });
});
