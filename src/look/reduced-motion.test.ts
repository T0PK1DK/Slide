import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const components = readFileSync(new URL("./components.css", import.meta.url), "utf8");
const live = readFileSync(new URL("./live.css", import.meta.url), "utf8");

describe("look reduced-motion audit", () => {
  it("turns off pin, card, hologram, and skeleton motion", () => {
    expect(components).toContain("@media (prefers-reduced-motion: reduce)");
    for (const token of [
      ".look-skel-pin",
      ".look-holo-scan",
      ".look-holo-ring",
      ".look-sheet.is-preview-enter",
      ".look-holo-stage.is-preview-reveal",
      ".look-holo-float.is-in",
      ".look-holo-stage.is-reveal",
      "look-rise-in",
    ]) {
      expect(components).toContain(token);
    }
    const reduce = components.split("@media (prefers-reduced-motion: reduce)")[1] ?? "";
    expect(reduce).toContain(".look-skel-pin");
    expect(reduce).toContain(".look-sheet.is-preview-enter");
    expect(reduce).toContain(".look-holo-stage.is-preview-reveal");
    expect(reduce).toContain(".look-holo-scan");
    expect(reduce).toContain("animation: none");
    const pulseAt = components.lastIndexOf("animation: look-pulse");
    const stillAt = components.lastIndexOf(".look-skel-pin");
    expect(pulseAt).toBeGreaterThan(0);
    expect(stillAt).toBeGreaterThan(pulseAt);
    expect(components.slice(stillAt, stillAt + 160)).toContain("animation: none");
  });

  it("still-gates the live HUD lift and load pulse", () => {
    const reduce = live.split("@media (prefers-reduced-motion: reduce)")[1] ?? "";
    expect(reduce).toContain(".look-skel-pin");
    expect(reduce).toContain("look-live-status");
    expect(reduce).toContain("transition: none");
  });
});
