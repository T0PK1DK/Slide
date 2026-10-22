import { describe, expect, it } from "vitest";
import { formatCloseHint, formatHours } from "./hours";

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

  it("names today's close when the place is open", () => {
    const tue = new Date("2026-10-20T15:00:00");
    const sun = new Date("2026-10-25T15:00:00");
    expect(formatCloseHint("Mo-Su 06:00-23:00", true, tue)).toBe("closes 11p");
    expect(formatCloseHint("Mo-Sa 08:00-22:00; Su 08:00-21:00", true, tue)).toBe("closes 10p");
    expect(formatCloseHint("Mo-Sa 08:00-22:00; Su 08:00-21:00", true, sun)).toBe("closes 9p");
    expect(formatCloseHint("24/7", true, tue)).toBeNull();
    expect(formatCloseHint("Mo-Su 00:00-24:00", true, tue)).toBeNull();
    expect(formatCloseHint("Mo-Su 06:00-23:00", false, tue)).toBeNull();
    expect(formatCloseHint(undefined, true, tue)).toBeNull();
    expect(formatCloseHint("Hours unknown", true, tue)).toBeNull();
  });
});
