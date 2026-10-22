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

  it("keeps Home / Work / recents as row slots", () => {
    expect(HUD_HTML).toContain('id="recents"');
    expect(HUD_HTML).toContain('id="chip-home"');
    expect(HUD_HTML).toContain("recent-item place-chip");
    expect(HUD_HTML).toContain("fail-sheet");
    expect(HUD_HTML).toContain('id="loc-banner"');
    expect(HUD_HTML).toContain('id="net-sheet"');
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(css).toContain(".recent-item");
    const recent = css.split(".recent-item {")[1]?.slice(0, 360) ?? "";
    expect(recent).toContain("min-height: var(--touch)");
    expect(css).toContain(".recent-item[hidden]");
    expect(css.split(".recent-item[hidden]")[1]?.slice(0, 80) ?? "").toContain("display: none");
    expect(css).toContain(".suggest-status.is-empty");
    expect(css).toContain(".suggest-status.is-loading");
    const name = css.split(".suggest-name {")[1]?.slice(0, 280) ?? "";
    expect(name).toContain("text-overflow: ellipsis");
    const cardTitle = css.split(".place-card h2 {")[1]?.slice(0, 280) ?? "";
    expect(cardTitle).toContain("-webkit-line-clamp: 2");
  });

  it("gives the search bar the same handle and list type as the card", () => {
    expect(HUD_HTML).toContain("search-card-handle");
    expect(HUD_HTML).toContain('id="to-suggest"');
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(css).toContain(".suggest-name");
    expect(css).toContain(".suggest-addr");
    const addr = css.split(".suggest-addr")[1]?.slice(0, 280) ?? "";
    expect(addr).toContain("font-family: var(--font-mono)");
    expect(addr).toContain("text-transform: uppercase");
    expect(css).not.toMatch(/#search-card\s*\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  it("circles the search close to match the look sheet", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(css).toContain(".place-card #place-close");
    expect(css).toContain(".place-card-handle");
    const close = css.split(".place-card #place-close")[1]?.slice(0, 280) ?? "";
    expect(close).toContain("padding: 0");
    expect(close).toContain("border-radius: var(--radius-full)");
    expect(close).toContain("place-items: center");
  });
});
