import { cloud, cloudConfigured } from "../cloud";
import { dropStale, sanitizeCarModelKey, sanitizeGhostColor, shouldPublishUpdate } from "./rules";
import {
  GHOST_MIN_INTERVAL_MS,
  GHOST_TTL_MS,
  type Ghost,
  type GhostInvite,
  type GhostSample,
  type GhostShareStatus,
} from "./types";

type GhostRow = {
  user_id: string;
  display_name: string;
  car_model_key: string;
  color: string;
  lat: number;
  lon: number;
  heading_deg: number;
  speed_mps: number;
  updated_at: string;
};

type InviteRow = {
  id: number;
  from_id: string;
  to_id: string;
  handle: string;
  display_name: string;
  status: GhostShareStatus;
  incoming: boolean;
  created_at: string;
};

let lastPublish = 0;

export function resetGhostThrottle(at = 0): void {
  lastPublish = at;
}

function fromRow(r: GhostRow): Ghost {
  return {
    userId: r.user_id,
    displayName: r.display_name,
    carModelKey: r.car_model_key,
    color: r.color,
    lat: r.lat,
    lon: r.lon,
    headingDeg: r.heading_deg,
    speedMps: r.speed_mps,
    updatedAt: Date.parse(r.updated_at),
  };
}

/** Opt-in publish of the latest point. No-ops inside the 2 s throttle. */
export async function publishGhost(sample: GhostSample, now = Date.now()): Promise<boolean> {
  if (!cloudConfigured()) return false;
  const gate = shouldPublishUpdate(lastPublish || null, now);
  if (!gate.publish) return false;
  const sb = await cloud();
  const { error } = await sb.rpc("share_ghost", {
    p_lat: sample.lat,
    p_lon: sample.lon,
    p_heading_deg: sample.headingDeg,
    p_speed_mps: sample.speedMps,
    p_car_model_key: sanitizeCarModelKey(sample.carModelKey),
    p_color: sanitizeGhostColor(sample.color),
    p_display_name: sample.displayName.trim().slice(0, 24) || "Driver",
  });
  if (error) throw new Error(error.message);
  lastPublish = now;
  return true;
}

/** Stop broadcasting; keep approved friends. */
export async function pauseGhost(): Promise<void> {
  if (!cloudConfigured()) return;
  const sb = await cloud();
  const { error } = await sb.rpc("pause_ghost");
  if (error) throw new Error(error.message);
  lastPublish = 0;
}

/** Stop broadcasting (same as pause — approvals stay until revoke). */
export async function stopGhost(): Promise<void> {
  await pauseGhost();
}

export async function inviteGhost(handle: string): Promise<number> {
  const sb = await cloud();
  const { data, error } = await sb.rpc("invite_ghost", { p_handle: handle.replace(/^@/, "").trim() });
  if (error) throw new Error(error.message);
  return Number(data);
}

export async function acceptGhostInvite(id: number): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.rpc("respond_ghost_invite", { p_id: id, p_accept: true });
  if (error) throw new Error(error.message);
}

export async function declineGhostInvite(id: number): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.rpc("respond_ghost_invite", { p_id: id, p_accept: false });
  if (error) throw new Error(error.message);
}

export async function revokeGhostShare(otherUserId: string): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.rpc("revoke_ghost_share", { p_other: otherUserId });
  if (error) throw new Error(error.message);
}

export async function listGhostInvites(): Promise<GhostInvite[]> {
  const sb = await cloud();
  const { data, error } = await sb.rpc("list_ghost_invites");
  if (error) throw new Error(error.message);
  return ((data ?? []) as InviteRow[]).map((r) => ({
    id: r.id,
    fromId: r.from_id,
    toId: r.to_id,
    handle: r.handle,
    displayName: r.display_name,
    status: r.status,
    incoming: r.incoming,
    createdAt: Date.parse(r.created_at),
  }));
}

export async function listLiveGhosts(now = Date.now()): Promise<Ghost[]> {
  if (!cloudConfigured()) return [];
  const sb = await cloud();
  const { data, error } = await sb.rpc("friends_ghosts");
  if (error) throw new Error(error.message);
  return dropStale(((data ?? []) as GhostRow[]).map(fromRow), now, GHOST_TTL_MS);
}

export type GhostWatch = { stop(): void };

/**
 * Minimal hook for Leon: latest approved ghosts, Realtime when the channel is
 * up, poll fallback otherwise. Caller must already be opted in / signed in.
 */
export function watchLiveGhosts(onChange: (ghosts: Ghost[]) => void): GhostWatch {
  let stopped = false;
  let ghosts: Ghost[] = [];
  let unsub: (() => void) | undefined;

  const emit = () => {
    if (!stopped) onChange(dropStale(ghosts, Date.now()));
  };

  const pull = async () => {
    try {
      ghosts = await listLiveGhosts();
      emit();
    } catch {
      emit();
    }
  };

  void pull();
  const poll = setInterval(() => void pull(), GHOST_MIN_INTERVAL_MS * 2);

  if (cloudConfigured()) {
    void cloud().then((sb) => {
      if (stopped) return;
      const ch = sb
        .channel("slide-ghosts")
        .on("postgres_changes", { event: "*", schema: "public", table: "ghosts" }, (payload) => {
          const row = (payload.new ?? payload.old) as Partial<GhostRow> | null;
          if (!row?.user_id) {
            void pull();
            return;
          }
          if (payload.eventType === "DELETE") {
            ghosts = ghosts.filter((g) => g.userId !== row.user_id);
            emit();
            return;
          }
          const next = fromRow(row as GhostRow);
          ghosts = dropStale([...ghosts.filter((g) => g.userId !== next.userId), next], Date.now());
          emit();
        })
        .subscribe();
      unsub = () => {
        void sb.removeChannel(ch);
      };
    });
  }

  return {
    stop() {
      stopped = true;
      clearInterval(poll);
      unsub?.();
    },
  };
}
