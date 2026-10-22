import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HUD_HTML } from "./shell";

describe("search place card chrome", () => {
  it("shares the look sheet handle, title ids, and action tiles", () => {
    expect(HUD_HTML).toContain('id="place-card"');
    expect(HUD_HTML).toContain("place-card-handle");
    expect(HUD_HTML).toContain("place-card-head");
    expect(HUD_HTML).toContain('id="place-name"');
    expect(HUD_HTML).toContain('id="place-addr"');
    expect(HUD_HTML).toContain('id="place-save"');
    expect(HUD_HTML).toContain('id="place-go"');
    expect(HUD_HTML).toContain('id="place-close"');
    expect(HUD_HTML).toContain("<small>");
  });

  it("does not let look CSS target the search card", () => {
    const look = readFileSync(new URL("../look/components.css", import.meta.url), "utf8");
    expect(look).not.toContain("#place-card");
    expect(look).toContain(".look-sheet-handle");
  });
});
