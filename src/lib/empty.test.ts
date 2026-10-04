import { describe, expect, it } from "vitest";
import { EMPTY, isEmptyValue, postedSignText, setMaybeEmpty } from "./empty";

describe("empty value styling", () => {
  it("treats placeholder copy as empty, not a real numeral", () => {
    expect(isEmptyValue(EMPTY.maneuverDist)).toBe(true);
    expect(isEmptyValue("Soon")).toBe(true);
    expect(isEmptyValue("14 min")).toBe(false);
    expect(isEmptyValue("0.4 mi")).toBe(false);
  });

  it("toggles .is-empty on the element", () => {
    const flags = new Set<string>();
    const el = {
      textContent: "",
      classList: {
        toggle: (name: string, on?: boolean) => {
          if (on) flags.add(name);
          else flags.delete(name);
        },
        contains: (name: string) => flags.has(name),
      },
    } as unknown as HTMLElement;
    setMaybeEmpty(el, EMPTY.score);
    expect(el.classList.contains("is-empty")).toBe(true);
    setMaybeEmpty(el, "12 min");
    expect(el.classList.contains("is-empty")).toBe(false);
    expect(el.textContent).toBe("12 min");
  });

  it("draws an unsigned limit as --, never No sign", () => {
    expect(postedSignText(null)).toBe("--");
    expect(postedSignText(undefined)).toBe("--");
    expect(postedSignText(35)).toBe("35");
    expect(postedSignText(null)).not.toBe(EMPTY.posted);
  });
});
