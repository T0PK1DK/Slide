import { describe, expect, it } from "vitest";
import { LIVERIES, VEHICLES, vehicleById } from "../vehicles";
import {
  isLiveryUnlocked,
  isVehicleUnlocked,
  newlyUnlocked,
  STARTER_VEHICLE_IDS,
  unlockCatalog,
  unlockLabel,
  unlockedLiveries,
  unlockedVehicles,
} from "./unlocks";

const starter = { level: 1, badges: {} };

describe("unlocks", () => {
  it("keeps every existing Garage ride and livery unlocked at level 1", () => {
    for (const v of VEHICLES) expect(isVehicleUnlocked(v.id, starter)).toBe(true);
    for (const l of LIVERIES) expect(isLiveryUnlocked(l, starter)).toBe(true);
    expect(STARTER_VEHICLE_IDS).toEqual(VEHICLES.map((v) => v.id));
    expect(unlockedVehicles(starter).map((v) => v.id)).toEqual(VEHICLES.map((v) => v.id));
    expect(unlockedLiveries(starter)).toEqual([...LIVERIES]);
  });

  it("locks Nimbus until level 5 and Glider until Night Owl silver", () => {
    expect(isVehicleUnlocked("nimbus", starter)).toBe(false);
    expect(isVehicleUnlocked("nimbus", { level: 5, badges: {} })).toBe(true);
    expect(isVehicleUnlocked("glider", { level: 20, badges: { "night-owl": "bronze" } })).toBe(false);
    expect(isVehicleUnlocked("glider", { level: 1, badges: { "night-owl": "silver" } })).toBe(true);
    expect(isVehicleUnlocked("glider", { level: 1, badges: { "night-owl": "gold" } })).toBe(true);
  });

  it("locks Halo / Dusk behind badges, never a licensed brand", () => {
    expect(isLiveryUnlocked("halo", starter)).toBe(false);
    expect(isLiveryUnlocked("dusk", starter)).toBe(false);
    expect(isLiveryUnlocked("halo", { level: 1, badges: { "gentle-brake": "silver" } })).toBe(true);
    expect(isLiveryUnlocked("dusk", { level: 1, badges: { "night-owl": "bronze" } })).toBe(true);
    const names = unlockCatalog().map((u) => u.name.toLowerCase()).join(" ");
    expect(names).not.toMatch(/porsche|ferrari|bmw|toyota|ford|honda|tesla|forza|need for speed/);
  });

  it("lists only what just opened", () => {
    const gained = newlyUnlocked(starter, { level: 5, badges: {} });
    expect(gained.some((u) => u.id === "nimbus")).toBe(true);
    expect(gained.some((u) => u.id === "slipstream")).toBe(false);
  });

  it("names the unlock requirement for the stage", () => {
    expect(unlockLabel({ kind: "starter" })).toBe("Unlocked");
    expect(unlockLabel({ kind: "level", level: 5 })).toBe("Level 5");
    expect(unlockLabel({ kind: "badge", badge: "night-owl", tier: "silver" })).toBe("Night Owl Silver");
    expect(unlockLabel({ kind: "badge", badge: "gentle-brake", tier: "silver" })).toBe("Soft Pedal Silver");
  });

  it("does not break vehicleById for the new originals", () => {
    expect(vehicleById("nimbus").name).toBe("Nimbus");
    expect(vehicleById("glider").name).toBe("Glider");
    expect(vehicleById("slipstream").name).toBe("Slipstream");
  });
});
