import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { setAccountOwner } from "./account-store";
import { clearAuthStorage } from "./auth-storage";
import { cloud, cloudConfigured } from "./cloud";
import { requestPersistentStorage } from "./profile";

/**
 * Slide accounts: username + password, no email step.
 *
 * Supabase Auth only knows emails, so a username maps to a synthetic address
 * `<username>@users.slide.local`. `.local` is reserved (RFC 6762) and Supabase's
 * mailer refuses it, so no email is ever sent to these addresses. This needs
 * Auth → Providers → Email → "Confirm email" OFF in the Supabase dashboard.
 * The uid stays the account key, so garage scoping, friends and RLS are unchanged.
 */
export const USERNAME_EMAIL_DOMAIN = "users.slide.local";
export const PASSWORD_MIN = 8;
/** bcrypt (GoTrue) ignores bytes past 72. */
export const PASSWORD_MAX = 72;

export type CloudUser = { id: string; email: string | null; username: string | null };

type AuthError = { message: string; code?: string; status?: number } | null;

export type AuthApi = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null }; error: AuthError }>;
    signUp: (creds: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }) => Promise<{ data: { session: Session | null; user: Session["user"] | null }; error: AuthError }>;
    signInWithPassword: (creds: {
      email: string;
      password: string;
    }) => Promise<{ data: { session: Session | null }; error: AuthError }>;
    signOut: () => Promise<{ error: AuthError }>;
    onAuthStateChange: (
      cb: (event: string, session: Session | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
};

let cached: CloudUser | null = null;
let listening = false;

export function currentCloudUser(): CloudUser | null {
  return cached;
}

/** Pure: a username Slide accepts — 3–20 letters, numbers or underscores, stored lowercase. */
export function normalizeUsername(raw: string): string | null {
  const u = raw.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(u) ? u : null;
}

/** Pure: the hidden Supabase email for a username, or null if the username is invalid. */
export function usernameToEmail(raw: string): string | null {
  const u = normalizeUsername(raw);
  return u ? `${u}@${USERNAME_EMAIL_DOMAIN}` : null;
}

/** Pure: the username behind a synthetic email, or null for a real (older) email account. */
export function usernameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.toLowerCase().lastIndexOf("@");
  if (at < 0 || email.slice(at + 1).toLowerCase() !== USERNAME_EMAIL_DOMAIN) return null;
  return normalizeUsername(email.slice(0, at));
}

/** Pure: why a password won't do, or null if it's fine. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password needs at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Password can be at most ${PASSWORD_MAX} characters.`;
  return null;
}

export const USERNAME_RULE = "Usernames are 3–20 letters, numbers or underscores.";

/** Shown when Supabase still has "Confirm email" on, so a username account can't finish. */
export const CONFIRM_EMAIL_ON =
  "Accounts are almost ready: the server still asks for email confirmation. King needs to switch off “Confirm email” in Supabase (Authentication → Sign In / Providers → Email).";

/** Pure: what the app shows for the signed-in account — the username, never the fake email. */
export function accountLabel(user: CloudUser | null): string | null {
  if (!user) return null;
  return user.username ? `@${user.username}` : user.email;
}

function asUser(session: Session | null): CloudUser | null {
  const id = session?.user?.id;
  if (!id) return null;
  const email = session.user.email ?? null;
  const meta = session.user.user_metadata as { username?: unknown } | undefined;
  const fromMeta = typeof meta?.username === "string" ? normalizeUsername(meta.username) : null;
  return { id, email, username: usernameFromEmail(email) ?? fromMeta };
}

function applySession(session: Session | null) {
  cached = asUser(session);
  setAccountOwner(cached?.id ?? null);
}

/** Pure: turn a Supabase auth error into something a driver can act on. */
export function friendlyAuthError(err: { message: string; code?: string }, mode: "in" | "up"): string {
  const m = err.message ?? "";
  const code = err.code ?? "";
  if (code === "user_already_exists" || /already registered|already exists/i.test(m)) {
    return "That username is taken. Try another, or sign in.";
  }
  if (code === "invalid_credentials" || /invalid login credentials/i.test(m)) {
    return "Wrong username or password.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(m)) return CONFIRM_EMAIL_ON;
  if (code === "email_address_invalid" || /email address .*invalid|confirmation email|sending.*email/i.test(m)) {
    return mode === "up" ? CONFIRM_EMAIL_ON : "Wrong username or password.";
  }
  if (code === "weak_password" || /password should/i.test(m)) return m;
  if (code === "signup_disabled" || /signups not allowed/i.test(m)) return "New accounts are switched off right now.";
  if (code === "over_request_rate_limit" || /rate limit|too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/failed to fetch|network/i.test(m)) return "No connection. Check your signal and try again.";
  return m || "Something went wrong. Try again.";
}

function checkInputs(username: string, password: string): string {
  const email = usernameToEmail(username);
  if (!email) throw new Error(USERNAME_RULE);
  const bad = passwordProblem(password);
  if (bad) throw new Error(bad);
  return email;
}

/** Create a username account and sign in. persistSession keeps it on this phone. */
export async function signUpWithUsername(username: string, password: string, api?: AuthApi): Promise<CloudUser> {
  const email = checkInputs(username, password);
  const sb = api ?? (await cloud());
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { username: normalizeUsername(username) } },
  });
  if (error) throw new Error(friendlyAuthError(error, "up"));
  // With "Confirm email" on, GoTrue returns a user but no session (and, for a taken
  // name, an obfuscated user with no identities). Either way nobody is signed in.
  if (!data.session) {
    const identities = (data.user as { identities?: unknown[] } | null)?.identities;
    if (Array.isArray(identities) && identities.length === 0) throw new Error("That username is taken. Try another, or sign in.");
    throw new Error(CONFIRM_EMAIL_ON);
  }
  applySession(data.session);
  return cached!;
}

/** Sign in with username + password. */
export async function signInWithUsername(username: string, password: string, api?: AuthApi): Promise<CloudUser> {
  const email = usernameToEmail(username);
  if (!email) throw new Error(USERNAME_RULE);
  if (!password) throw new Error("Enter your password.");
  const sb = api ?? (await cloud());
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error, "in"));
  if (!data.session) throw new Error("Wrong username or password.");
  applySession(data.session);
  return cached!;
}

export async function restoreSession(api?: AuthApi): Promise<CloudUser | null> {
  const sb = api ?? (await cloud());
  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(error.message);
  applySession(data.session);
  return cached;
}

export async function signOutAccount(api?: AuthApi): Promise<void> {
  const sb = api ?? (await cloud());
  await sb.auth.signOut();
  applySession(null);
  clearAuthStorage();
}

/**
 * Subscribe once. INITIAL_SESSION restores a saved login; SIGNED_IN lands a
 * fresh sign-in; TOKEN_REFRESHED keeps the 90-day cookie fresh; SIGNED_OUT
 * clears the owner so the next driver does not see this garage.
 */
export function listenAuthState(
  api: AuthApi,
  onChange?: (event: string, user: CloudUser | null) => void
): Promise<CloudUser | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (user: CloudUser | null) => {
      if (settled) return;
      settled = true;
      resolve(user);
    };
    api.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") applySession(null);
      else applySession(session);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        void requestPersistentStorage();
      }
      onChange?.(event, cached);
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") finish(cached);
    });
    void api.auth.getSession().then(({ data }) => {
      applySession(data.session);
      finish(cached);
    });
  });
}

/** Create the client and restore a saved session on boot. */
export async function prepareAccount(): Promise<CloudUser | null> {
  if (!cloudConfigured()) return null;
  let sb: SupabaseClient;
  try {
    sb = await cloud();
  } catch {
    return null;
  }
  if (!listening) {
    listening = true;
    await listenAuthState(sb as unknown as AuthApi);
  } else {
    await restoreSession(sb as unknown as AuthApi);
  }
  return cached;
}
