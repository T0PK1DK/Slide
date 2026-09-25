import { cloud, cloudConfigured } from "./cloud";

/**
 * Friends on the map. The server rounds every shared position to ~1 km and
 * returns only mutual friends seen in the last 15 minutes
 * (supabase/migrations/…_friend_presence.sql). This module never shares unless
 * the driver turned it on.
 */
export type FriendSpot = { id: string; handle: string; name: string; carTag: string | null; lat: number; lon: number; updatedAt: number };

/** Pure: round like the server does, so the client never even sends more than it needs. */
export function roughen(v: number): number {
  return Math.round(v * 100) / 100;
}

export async function sharePresence(lat: number, lon: number): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.rpc("share_presence", { p_lat: roughen(lat), p_lon: roughen(lon) });
  if (error) throw new Error(error.message);
}

export async function stopPresence(): Promise<void> {
  if (!cloudConfigured()) return;
  const sb = await cloud();
  await sb.rpc("stop_presence");
}

export async function friendsPresence(): Promise<FriendSpot[]> {
  const sb = await cloud();
  const { data, error } = await sb.rpc("friends_presence");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; handle: string; display_name: string; car_tag: string | null; lat: number; lon: number; updated_at: string }>).map((r) => ({
    id: r.id,
    handle: r.handle,
    name: r.display_name,
    carTag: r.car_tag,
    lat: r.lat,
    lon: r.lon,
    updatedAt: Date.parse(r.updated_at),
  }));
}
