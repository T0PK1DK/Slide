/**
 * Map levels and badges onto rides and liveries.
 * Starter six + Solid/Stripes/Fade stay free so the existing Garage still works.
 * No licensed brands — unlocks are original Slide designs only.
 */
import { BADGE_BY_ID, TIER_ORDER, type BadgeId, type BadgeTier } from "./badges";
import {
  ALL_LIVERIES,
  ALL_VEHICLES,
  LIVERY_LABEL,
  STARTER_LIVERIES,
  UNLOCK_LIVERIES,
  UNLOCK_VEHICLES,
  VEHICLES,
  type Livery,
  type UnlockLivery,
  type UnlockVehicleId,
  type Vehicle,
  type VehicleId,
} from "../vehicles";

export type UnlockKind = "vehicle" | "livery";

export type UnlockReq =
  | { kind: "starter" }
  | { kind: "level"; level: number }
  | { kind: "badge"; badge: BadgeId; tier: BadgeTier };

export type UnlockDef = {
  type: UnlockKind;
  id: string;
  name: string;
  req: UnlockReq;
};

export const STARTER_VEHICLE_IDS: readonly VehicleId[] = VEHICLES.map((v) => v.id);

export const VEHICLE_UNLOCKS: Record<UnlockVehicleId, UnlockReq> = {
  nimbus: { kind: "level", level: 5 },
  glider: { kind: "badge", badge: "night-owl", tier: "silver" },
};

export const LIVERY_UNLOCKS: Record<UnlockLivery, UnlockReq> = {
  halo: { kind: "badge", badge: "gentle-brake", tier: "silver" },
  dusk: { kind: "badge", badge: "night-owl", tier: "bronze" },
};

export function unlockCatalog(): UnlockDef[] {
  const starters: UnlockDef[] = [
    ...VEHICLES.map((v) => ({ type: "vehicle" as const, id: v.id, name: v.name, req: { kind: "starter" as const } })),
    ...STARTER_LIVERIES.map((l) => ({ type: "livery" as const, id: l, name: LIVERY_LABEL[l], req: { kind: "starter" as const } })),
  ];
  const locked: UnlockDef[] = [
    ...UNLOCK_VEHICLES.map((v) => ({
      type: "vehicle" as const,
      id: v.id,
      name: v.name,
      req: VEHICLE_UNLOCKS[v.id as UnlockVehicleId],
    })),
    ...UNLOCK_LIVERIES.map((l) => ({
      type: "livery" as const,
      id: l,
      name: LIVERY_LABEL[l],
      req: LIVERY_UNLOCKS[l],
    })),
  ];
  return [...starters, ...locked];
}

export type UnlockProgress = {
  level: number;
  badges: Partial<Record<BadgeId, BadgeTier>>;
};

function tierMet(have: BadgeTier | undefined, need: BadgeTier): boolean {
  if (!have) return false;
  return TIER_ORDER.indexOf(have) >= TIER_ORDER.indexOf(need);
}

export function meetsUnlock(req: UnlockReq, progress: UnlockProgress): boolean {
  if (req.kind === "starter") return true;
  if (req.kind === "level") return progress.level >= req.level;
  return tierMet(progress.badges[req.badge], req.tier);
}

export function isVehicleUnlocked(id: string, progress: UnlockProgress): boolean {
  if ((STARTER_VEHICLE_IDS as readonly string[]).includes(id)) return true;
  const req = VEHICLE_UNLOCKS[id as UnlockVehicleId];
  return req ? meetsUnlock(req, progress) : false;
}

export function isLiveryUnlocked(id: string, progress: UnlockProgress): boolean {
  if ((STARTER_LIVERIES as readonly string[]).includes(id)) return true;
  const req = LIVERY_UNLOCKS[id as UnlockLivery];
  return req ? meetsUnlock(req, progress) : false;
}

export function unlockedVehicles(progress: UnlockProgress): Vehicle[] {
  return ALL_VEHICLES.filter((v) => isVehicleUnlocked(v.id, progress));
}

export function unlockedLiveries(progress: UnlockProgress): Livery[] {
  return ALL_LIVERIES.filter((l) => isLiveryUnlocked(l, progress));
}

/** One-line unlock requirement for the stage picker. */
export function unlockLabel(req: UnlockReq): string {
  if (req.kind === "starter") return "Unlocked";
  if (req.kind === "level") return `Level ${req.level}`;
  const badge = BADGE_BY_ID[req.badge].name;
  const tier = req.tier.charAt(0).toUpperCase() + req.tier.slice(1);
  return `${badge} ${tier}`;
}

export function newlyUnlocked(
  before: UnlockProgress,
  after: UnlockProgress
): Array<{ type: UnlockKind; id: string; name: string }> {
  const out: Array<{ type: UnlockKind; id: string; name: string }> = [];
  for (const def of unlockCatalog()) {
    if (!meetsUnlock(def.req, before) && meetsUnlock(def.req, after)) {
      out.push({ type: def.type, id: def.id, name: def.name });
    }
  }
  return out;
}
