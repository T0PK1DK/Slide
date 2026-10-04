import { describe, expect, it } from "vitest";
import { divasKind, divasUrl, fromDivas, parseUsUtc } from "./sources/fdot";
import { fromMdpd, mdpdKind, nyLocalToEpoch } from "./sources/mdpd";

// Shapes copied from the live feeds on 2026-10-04 (trimmed).
const DIVAS = {
  attributes: {
    id: "2819397", timestamp: "10/04/2026 1:51:38 PM", eventtypedesc: "Crash", severity: "minor", county: "Palm Beach",
    highway: "I-95", direction: "n", latitude: 26.650297, longitude: -80.068252,
    descriptionen: "Multi-vehicle crash in Palm Beach County on I-95 North, before Exit 66: SR-882/Forest Hill Blvd. Right lane blocked.",
  },
  geometry: { x: -80.068252, y: 26.650297 },
};
const MDPD = { createTime: "2026-10-04T09:47:44.000", signal: "TRAFFIC ACCIDENT WITH INJURIES", address: "NW 135TH ST / NW 7TH AVE", location: "SB ON NW 7 AVE/135 ST", grid: "4390", longitude: -80.21127826, latitude: 25.89826765 };

describe("FDOT DIVAS", () => {
  it("maps a real event", () => {
    expect(fromDivas(DIVAS)).toMatchObject({
      id: "fdot-2819397", source: "fdot", kind: "crash", lat: 26.650297, lon: -80.068252,
      title: "Crash on I-95 N", createdAt: Date.UTC(2026, 9, 4, 13, 51, 38), reportId: null,
    });
    expect(fromDivas(DIVAS)!.detail.startsWith("FDOT · Multi-vehicle crash")).toBe(true);
  });
  it("kinds and times", () => {
    expect(divasKind("Scheduled Road Work", "")).toBe("roadwork");
    expect(divasKind("Disabled Vehicle", "")).toBe("hazard");
    expect(divasKind("Off Ramp Backup", "")).toBe("jam");
    expect(divasKind("Crash", "All lanes blocked.")).toBe("closure");
    expect(parseUsUtc("10/04/2026 12:05:00 AM")).toBe(Date.UTC(2026, 9, 4, 0, 5));
    expect(parseUsUtc("10/04/2026 12:05:00 PM")).toBe(Date.UTC(2026, 9, 4, 12, 5));
    expect(fromDivas({ attributes: { id: "x" } })).toBeNull();
    expect(divasUrl()).toContain("geometry=-81.6%2C24.4%2C-79.9%2C27.2");
  });
});

describe("Miami-Dade Police", () => {
  it("maps a real call, Miami local time → UTC", () => {
    expect(fromMdpd(MDPD)).toMatchObject({
      source: "mdpd", kind: "crash", title: "Traffic Accident With Injuries at NW 135th St / NW 7th Ave",
      detail: "Miami-Dade Police · SB ON NW 7 AVE/135 ST · dispatched call", createdAt: Date.UTC(2026, 9, 4, 13, 47, 44),
    });
  });
  it("handles winter time and kinds", () => {
    expect(nyLocalToEpoch("2026-01-15T08:00:00.000")).toBe(Date.UTC(2026, 0, 15, 13, 0));
    expect(mdpdKind("HIT AND RUN")).toBe("crash");
    expect(mdpdKind("DISABLED VEHICLE")).toBe("hazard");
    expect(fromMdpd({ signal: "TRAFFIC ACCIDENT" })).toBeNull();
  });
});
