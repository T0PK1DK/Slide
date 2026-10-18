/** Precise live ghost. Only the latest point is kept; stale rows drop after TTL. */

export type Ghost = {
  userId: string;
  displayName: string;
  carModelKey: string;
  color: string;
  lat: number;
  lon: number;
  headingDeg: number;
  speedMps: number;
  updatedAt: number;
};

export type GhostShareStatus = "pending" | "accepted" | "declined" | "revoked";

export type GhostShare = {
  fromId: string;
  toId: string;
  status: GhostShareStatus;
};

export type GhostInvite = {
  id: number;
  fromId: string;
  toId: string;
  handle: string;
  displayName: string;
  status: GhostShareStatus;
  incoming: boolean;
  createdAt: number;
};

export type GhostSample = {
  lat: number;
  lon: number;
  headingDeg: number;
  speedMps: number;
  displayName: string;
  carModelKey: string;
  color: string;
};

/** Client publishes at most once per 2 s, and should send at least every 5 s while moving. */
export const GHOST_MIN_INTERVAL_MS = 2_000;
export const GHOST_MAX_INTERVAL_MS = 5_000;
/** Positions older than this are gone — no history. */
export const GHOST_TTL_MS = 45_000;
