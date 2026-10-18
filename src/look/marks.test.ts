import { describe, expect, it } from "vitest";
import { contrastInk, hasBundledMark, monogramLetter, pinBadgeSvg, pinColor } from "./marks";

describe("store pin marks", () => {
  it("uses brand color and a monogram when the chain is known", () => {
    const store = { brandKey: "walmart", brand: "Walmart", name: "Walmart Supercenter", color: "#0071ce", category: "grocery" as const };
    expect(pinColor(store)).toBe("#0071ce");
    expect(monogramLetter(store)).toBe("W");
    expect(hasBundledMark(store)).toBe(true);
    expect(pinBadgeSvg(store)).toContain("Walmart".charAt(0) === "W" ? ">W<" : "");
    expect(pinBadgeSvg(store)).toContain("#0071ce");
  });

  it("falls back to category color and icon when there is no brand mark", () => {
    const store = { name: "Corner Mart", category: "other" as const };
    expect(hasBundledMark(store)).toBe(false);
    expect(pinColor(store)).toBe("#8a8f98");
    expect(pinBadgeSvg(store)).toContain("<path d=");
    expect(pinBadgeSvg(store)).not.toContain(">C<");
  });

  it("picks dark ink on pale brand discs", () => {
    expect(contrastInk("#ffd100")).toBe("#1a140c");
    expect(contrastInk("#0071ce")).toBe("#f7f3ea");
  });
});
