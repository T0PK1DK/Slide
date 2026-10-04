import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("design system metrics", () => {
  const body = stripComments(styles);

  it("keeps raw hex in the token file only", () => {
    expect(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect((stripComments(tokens).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length).toBeGreaterThan(10);
  });

  it("has no !important", () => {
    expect(body.match(/!important/g) ?? []).toEqual([]);
  });

  it("uses only the 9 type-scale tokens", () => {
    const sizes = [...body.matchAll(/font-size:\s*([^;]+)/g)].map((m) => m[1].trim());
    const allowed = new Set([
      "var(--fs-2xs)",
      "var(--fs-xs)",
      "var(--fs-sm)",
      "var(--fs-md)",
      "var(--fs-lg)",
      "var(--fs-xl)",
      "var(--fs-2xl)",
      "var(--fs-3xl)",
      "var(--fs-hero)",
    ]);
    expect(new Set(sizes)).toEqual(allowed);
  });

  it("uses only the 6 radius tokens", () => {
    const radii = [...body.matchAll(/border-radius:\s*([^;]+)/g)].map((m) => m[1].trim());
    const allowed = new Set([
      "var(--radius-sm)",
      "var(--radius-md)",
      "var(--radius-lg)",
      "var(--radius-xl)",
      "var(--radius-pill)",
      "var(--radius-full)",
    ]);
    for (const r of radii) {
      expect(allowed.has(r), r).toBe(true);
    }
  });
});
