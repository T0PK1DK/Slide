import { describe, expect, it } from "vitest";
import { formatHours } from "./hours";

describe("opening hours line", () => {
  it("turns a daily OSM tag into a short card line", () => {
    expect(formatHours("Mo-Su 06:00-23:00")).toBe("Daily 6a–11p");
  });

  it("keeps split weekend rules", () => {
    expect(formatHours("Mo-Sa 08:00-22:00; Su 08:00-21:00")).toBe("Mon–Sat 8a–10p · Sun 8a–9p");
  });

  it("leaves unknown tags alone", () => {
    expect(formatHours("24/7")).toBe("24/7");
    expect(formatHours("")).toBe("");
  });
});
