import { cloud } from "./cloud";

/**
 * Accounts, public profiles, follows and friends (mutual follows). Only what a
 * driver chooses to publish goes to the server: handle, display name, car tag,
 * and — only if they opt in — a car label. Drives, places and history stay on
 * the phone (HANDOFF rule 4).
 */
export type PublicProfile = {
  id: string;
  handle: string;
  display_name: string;
  car_tag: string | null;
  car_label: string | null;
};
export type SocialCounts = { followers: number; following: number; friends: number };
export type Relation = { following: boolean; followsYou: boolean };

/** Pure: a handle Slide accepts — 3–20 lowercase letters, digits or underscores. */
export function normalizeHandle(raw: string): string | null {
  const h = raw.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(h) ? h : null;
}

/** Pure: the "2023 Tesla Model 3" label shown on a public profile, or null. */
export function carLabel(car: { make: string; model: string; year: number | null } | null): string | null {
  if (!car) return null;
  const s = [car.year ?? "", car.make, car.model].join(" ").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 60) : null;
}

/** Pure: friends are people you follow who follow you back. */
export function mutuals(followingIds: string[], followerIds: string[]): string[] {
  const back = new Set(followerIds);
  return followingIds.filter((id) => back.has(id));
}

export async function currentUserId(): Promise<string | null> {
  const sb = await cloud();
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Step 1 of sign-in: email a 6-digit code. Creates the account on first use. */
export async function sendCode(email: string): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

/** Step 2: the code from the email. */
export async function verifyCode(email: string, code: string): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const sb = await cloud();
  await sb.auth.signOut();
}

export async function myProfile(): Promise<PublicProfile | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const sb = await cloud();
  const { data } = await sb.from("profiles").select("id, handle, display_name, car_tag, car_label").eq("id", uid).maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

/** Create or update your public profile. Throws a friendly message if the handle is taken. */
export async function saveMyProfile(p: Omit<PublicProfile, "id">): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sign in first.");
  const sb = await cloud();
  const { error } = await sb.from("profiles").upsert({ id: uid, ...p });
  if (error) throw new Error(error.code === "23505" ? `@${p.handle} is taken — try another.` : error.message);
}

export async function myCounts(): Promise<SocialCounts> {
  const sb = await cloud();
  const { data, error } = await sb.rpc("my_social_counts");
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return { followers: Number(row.followers ?? 0), following: Number(row.following ?? 0), friends: Number(row.friends ?? 0) };
}

export async function searchDrivers(q: string): Promise<PublicProfile[]> {
  const term = q.trim().replace(/^@/, "").replace(/[%_]/g, "");
  if (term.length < 2) return [];
  const sb = await cloud();
  const { data, error } = await sb
    .from("profiles")
    .select("id, handle, display_name, car_tag, car_label")
    .or(`handle.ilike.${term}%,display_name.ilike.${term}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicProfile[];
}

/** Everyone in your follow graph, with how each relates to you. */
export async function myNetwork(): Promise<Array<PublicProfile & Relation>> {
  const uid = await currentUserId();
  if (!uid) return [];
  const sb = await cloud();
  const { data: rows, error } = await sb.from("follows").select("follower_id, followee_id");
  if (error) throw new Error(error.message);
  const following = (rows ?? []).filter((r) => r.follower_id === uid).map((r) => r.followee_id as string);
  const followers = (rows ?? []).filter((r) => r.followee_id === uid).map((r) => r.follower_id as string);
  const ids = [...new Set([...following, ...followers])];
  if (!ids.length) return [];
  const { data: people } = await sb.from("profiles").select("id, handle, display_name, car_tag, car_label").in("id", ids);
  return ((people ?? []) as PublicProfile[]).map((p) => ({ ...p, following: following.includes(p.id), followsYou: followers.includes(p.id) }));
}

export async function follow(id: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sign in first.");
  const sb = await cloud();
  const { error } = await sb.from("follows").insert({ follower_id: uid, followee_id: id });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function unfollow(id: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  const sb = await cloud();
  await sb.from("follows").delete().eq("follower_id", uid).eq("followee_id", id);
}

export async function removeFollower(id: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  const sb = await cloud();
  await sb.from("follows").delete().eq("follower_id", id).eq("followee_id", uid);
}

export async function deleteAccount(): Promise<void> {
  const sb = await cloud();
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw new Error(error.message);
  await sb.auth.signOut();
}
