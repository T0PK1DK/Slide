import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { setAccountOwner } from "./account-store";
import { clearAuthStorage } from "./auth-storage";
import { authRedirectUrl, authReturn, cloud, cloudConfigured } from "./cloud";
import { requestPersistentStorage } from "./profile";

export type CloudUser = { id: string; email: string | null };

export type AuthLinkResult = { ok: true } | { ok: false; message: string };

export type AuthApi = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null }; error: { message: string } | null }>;
    signInWithOtp: (opts: {
      email: string;
      options?: { shouldCreateUser?: boolean; emailRedirectTo?: string };
    }) => Promise<{ error: { message: string } | null }>;
    verifyOtp: (opts: {
      email: string;
      token: string;
      type: "email";
    }) => Promise<{ error: { message: string } | null }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
    onAuthStateChange: (
      cb: (event: string, session: Session | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
};

let cached: CloudUser | null = null;
let listening = false;
let linkResult: AuthLinkResult | null = null;

export function currentCloudUser(): CloudUser | null {
  return cached;
}

export function takeAuthLinkResult(): AuthLinkResult | null {
  const r = linkResult;
  linkResult = null;
  return r;
}

export function peekAuthLinkResult(): AuthLinkResult | null {
  return linkResult;
}

function asUser(session: Session | null): CloudUser | null {
  const id = session?.user?.id;
  if (!id) return null;
  return { id, email: session.user.email ?? null };
}

function applySession(session: Session | null) {
  cached = asUser(session);
  setAccountOwner(cached?.id ?? null);
}

/** Pure: the 6-digit email OTP Slide accepts. Spaces are ignored. */
export function normalizeEmailOtp(raw: string): string | null {
  const digits = raw.replace(/\s+/g, "").trim();
  return /^\d{6}$/.test(digits) ? digits : null;
}

/**
 * Anyone can join: first use creates the user. The email has a 6-digit
 * code ({{ .Token }} in the Magic Link template) plus a link for Safari
 * or desktop. iPhone Home Screen must type the code — that webview does
 * not share cookies or localStorage with Safari.
 */
export async function sendMagicLink(email: string, api?: AuthApi, redirectTo?: string): Promise<void> {
  const sb = api ?? (await cloud());
  const back = redirectTo ?? authRedirectUrl(
    typeof location !== "undefined" ? location.origin : "",
    typeof location !== "undefined" ? location.pathname : "/"
  );
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: back },
  });
  if (error) throw new Error(error.message);
}

/** Finish sign-in in *this* app via the emailed OTP. persistSession then keeps it. */
export async function verifyMagicCode(email: string, code: string, api?: AuthApi): Promise<void> {
  const token = normalizeEmailOtp(code);
  if (!token) throw new Error("Enter the 6-digit code from the email.");
  const sb = api ?? (await cloud());
  const { error } = await sb.auth.verifyOtp({
    email: email.trim(),
    token,
    type: "email",
  });
  if (error) throw new Error(error.message);
  const { data } = await sb.auth.getSession();
  applySession(data.session);
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
 * Subscribe once. INITIAL_SESSION restores a saved login; SIGNED_IN lands
 * the magic-link return; TOKEN_REFRESHED keeps the 90-day cookie fresh;
 * SIGNED_OUT clears the owner so the next driver does not see this garage.
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

function stripAuthUrl() {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  history.replaceState(null, "", location.pathname);
}

/**
 * Create the client (so detectSessionInUrl can read the hash), restore a
 * saved session, and remember a magic-link error for the sign-in screen.
 */
export async function prepareAccount(): Promise<CloudUser | null> {
  if (!cloudConfigured()) return null;
  let sb: SupabaseClient;
  try {
    sb = await cloud();
  } catch {
    return null;
  }
  const hash = typeof location !== "undefined" ? location.hash : "";
  const search = typeof location !== "undefined" ? location.search : "";
  const ret = authReturn(hash, search);
  if (!listening) {
    listening = true;
    await listenAuthState(sb);
  } else {
    await restoreSession(sb);
  }
  if (ret?.kind === "error") {
    stripAuthUrl();
    linkResult = {
      ok: false,
      message: /expired|invalid/i.test(ret.message)
        ? "That sign-in link has expired or was already used. Email yourself a new one."
        : ret.message,
    };
    return cached;
  }
  if (ret?.kind === "session") {
    const { data, error } = await sb.auth.getSession();
    stripAuthUrl();
    if (error || !data.session) {
      linkResult = { ok: false, message: error?.message ?? "That sign-in link didn't work. Email yourself a new one." };
    } else {
      applySession(data.session);
      linkResult = { ok: true };
    }
  }
  return cached;
}
