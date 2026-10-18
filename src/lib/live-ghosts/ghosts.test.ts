import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  canInvite,
  canReadGhost,
  canRespondInvite,
  canRevokeShare,
  dropStale,
  isFresh,
  sanitizeCarModelKey,
  sanitizeGhostColor,
  shouldPublishUpdate,
} from "./rules";
import { GHOST_MAX_INTERVAL_MS, GHOST_MIN_INTERVAL_MS, GHOST_TTL_MS, type GhostShare } from "./types";

const king = "king";
const grim = "grim";
const leon = "leon";
const now = 1_000_000;

const ghost = (userId: string, age = 0) => ({ userId, updatedAt: now - age });
const accepted: GhostShare = { fromId: king, toId: grim, status: "accepted" };
const pending: GhostShare = { fromId: king, toId: grim, status: "pending" };
const declined: GhostShare = { fromId: king, toId: grim, status: "declined" };
const revoked: GhostShare = { fromId: king, toId: grim, status: "revoked" };

describe("ghost privacy", () => {
  it("unsigned, pending, declined, revoked, and strangers cannot read", () => {
    expect(canReadGhost({ viewerId: null, ghost: ghost(king), shares: [accepted], now })).toBe(false);
    expect(canReadGhost({ viewerId: grim, ghost: ghost(king), shares: [pending], now })).toBe(false);
    expect(canReadGhost({ viewerId: grim, ghost: ghost(king), shares: [declined], now })).toBe(false);
    expect(canReadGhost({ viewerId: grim, ghost: ghost(king), shares: [revoked], now })).toBe(false);
    expect(canReadGhost({ viewerId: leon, ghost: ghost(king), shares: [accepted], now })).toBe(false);
  });

  it("accepted invite is mutual; you can always see your own fresh point", () => {
    expect(canReadGhost({ viewerId: grim, ghost: ghost(king), shares: [accepted], now })).toBe(true);
    expect(canReadGhost({ viewerId: king, ghost: ghost(grim), shares: [accepted], now })).toBe(true);
    expect(canReadGhost({ viewerId: king, ghost: ghost(king), shares: [], now })).toBe(true);
  });

  it("paused / stale rows are gone (no history past TTL)", () => {
    expect(isFresh(now - GHOST_TTL_MS + 1, now)).toBe(true);
    expect(isFresh(now - GHOST_TTL_MS - 1, now)).toBe(false);
    expect(canReadGhost({ viewerId: grim, ghost: ghost(king, GHOST_TTL_MS + 1), shares: [accepted], now })).toBe(false);
    expect(dropStale([
      { userId: king, updatedAt: now - 1_000 },
      { userId: grim, updatedAt: now - GHOST_TTL_MS - 5 },
    ], now).map((g) => g.userId)).toEqual([king]);
  });

  it("only the invitee accepts; either party can revoke; no self-invite", () => {
    expect(canInvite(null, grim)).toEqual({ ok: false, reason: "sign-in" });
    expect(canInvite(king, king)).toEqual({ ok: false, reason: "self" });
    expect(canInvite(king, grim)).toEqual({ ok: true });
    expect(canRespondInvite({ actorId: grim, fromId: king, toId: grim, status: "pending" })).toBe(true);
    expect(canRespondInvite({ actorId: king, fromId: king, toId: grim, status: "pending" })).toBe(false);
    expect(canRespondInvite({ actorId: grim, fromId: king, toId: grim, status: "accepted" })).toBe(false);
    expect(canRevokeShare({ actorId: king, fromId: king, toId: grim })).toBe(true);
    expect(canRevokeShare({ actorId: grim, fromId: king, toId: grim })).toBe(true);
    expect(canRevokeShare({ actorId: leon, fromId: king, toId: grim })).toBe(false);
  });
});

describe("ghost throttle", () => {
  it("publishes first, blocks under 2 s, allows 2–5 s, and still sends when overdue", () => {
    expect(shouldPublishUpdate(null, now)).toEqual({ publish: true, reason: "first" });
    expect(shouldPublishUpdate(now, now + GHOST_MIN_INTERVAL_MS - 1)).toEqual({ publish: false, reason: "too-soon" });
    expect(shouldPublishUpdate(now, now + GHOST_MIN_INTERVAL_MS)).toEqual({ publish: true, reason: "due" });
    expect(shouldPublishUpdate(now, now + GHOST_MAX_INTERVAL_MS)).toEqual({ publish: true, reason: "overdue" });
  });

  it("sanitizes paint and car keys so nothing ugly hits the row", () => {
    expect(sanitizeGhostColor("#f0a04b")).toBe("#f0a04b");
    expect(sanitizeGhostColor("red")).toBe("#e8eef2");
    expect(sanitizeCarModelKey("Slipstream!")).toBe("slipstream");
    expect(sanitizeCarModelKey("")).toBe("classic");
  });
});

describe("ghost SQL contract", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261018000000_ghost_sharing.sql", import.meta.url), "utf8");

  it("keeps latest-point-only, 2 s throttle, 45 s TTL, and invite RLS", () => {
    expect(sql).toContain("create table public.ghosts");
    expect(sql).toContain("create table public.ghost_invites");
    expect(sql).toContain("interval '2 seconds'");
    expect(sql).toContain("interval '45 seconds'");
    expect(sql).toContain("status = 'accepted'");
    expect(sql).toContain("Approved friends can read live ghosts");
    expect(sql).toContain("on conflict (user_id) do update");
    expect(sql).toContain("alter publication supabase_realtime add table public.ghosts");
    expect(sql).not.toMatch(/ghost_history|ghost_points|trail/);
  });
});
