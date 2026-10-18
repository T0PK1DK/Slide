import {
  GHOST_MAX_INTERVAL_MS,
  GHOST_MIN_INTERVAL_MS,
  GHOST_TTL_MS,
  type Ghost,
  type GhostShare,
} from "./types";

/**
 * Privacy (mirrors supabase/migrations/…_ghost_sharing.sql):
 *   * Unsigned sees nobody.
 *   * You always see your own fresh point.
 *   * Anyone else needs an *accepted* invite in either direction (mutual after accept).
 *   * Pending / declined / revoked never grant a read.
 *   * A paused/stopped ghost has no fresh row (TTL or missing) and is not shown.
 */
export function canReadGhost(args: {
  viewerId: string | null;
  ghost: Pick<Ghost, "userId" | "updatedAt">;
  shares: readonly GhostShare[];
  now: number;
  ttlMs?: number;
}): boolean {
  const { viewerId, ghost, shares, now } = args;
  const ttl = args.ttlMs ?? GHOST_TTL_MS;
  if (!viewerId) return false;
  if (!isFresh(ghost.updatedAt, now, ttl)) return false;
  if (ghost.userId === viewerId) return true;
  return shares.some((s) => s.status === "accepted" && pair(s, viewerId, ghost.userId));
}

export function canInvite(fromId: string | null, toId: string | null): { ok: true } | { ok: false; reason: string } {
  if (!fromId) return { ok: false, reason: "sign-in" };
  if (!toId) return { ok: false, reason: "unknown-driver" };
  if (fromId === toId) return { ok: false, reason: "self" };
  return { ok: true };
}

export function canRespondInvite(args: { actorId: string | null; fromId: string; toId: string; status: GhostShare["status"] }): boolean {
  return Boolean(args.actorId && args.actorId === args.toId && args.status === "pending");
}

export function canRevokeShare(args: { actorId: string | null; fromId: string; toId: string }): boolean {
  return Boolean(args.actorId && (args.actorId === args.fromId || args.actorId === args.toId));
}

function pair(s: GhostShare, a: string, b: string): boolean {
  return (s.fromId === a && s.toId === b) || (s.fromId === b && s.toId === a);
}

export function isFresh(updatedAt: number, now: number, ttlMs = GHOST_TTL_MS): boolean {
  return now - updatedAt <= ttlMs;
}

export function dropStale<T extends { updatedAt: number }>(items: readonly T[], now: number, ttlMs = GHOST_TTL_MS): T[] {
  return items.filter((g) => isFresh(g.updatedAt, now, ttlMs));
}

export type PublishDecision = { publish: boolean; reason: "first" | "too-soon" | "due" | "overdue" };

/** Throttle: ignore updates inside 2 s; 2–5 s is the live window; >5 s is overdue but still sent. */
export function shouldPublishUpdate(
  lastPublishedAt: number | null,
  now: number,
  minMs = GHOST_MIN_INTERVAL_MS,
  maxMs = GHOST_MAX_INTERVAL_MS,
): PublishDecision {
  if (lastPublishedAt === null) return { publish: true, reason: "first" };
  const dt = now - lastPublishedAt;
  if (dt < minMs) return { publish: false, reason: "too-soon" };
  if (dt >= maxMs) return { publish: true, reason: "overdue" };
  return { publish: true, reason: "due" };
}

export function sanitizeGhostColor(raw: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(raw.trim()) ? raw.trim() : "#e8eef2";
}

export function sanitizeCarModelKey(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
  return s || "classic";
}
