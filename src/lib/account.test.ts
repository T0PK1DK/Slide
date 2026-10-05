import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import {
  listenAuthState,
  normalizeEmailOtp,
  restoreSession,
  sendMagicLink,
  signOutAccount,
  verifyMagicCode,
  type AuthApi,
} from "./account";
import { AUTH_CLIENT_OPTIONS, AUTH_SITE_URL, authRedirectUrl } from "./cloud";

function fakeSession(email: string, id = "user-1"): Session {
  return {
    access_token: "tok",
    refresh_token: "ref",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id, email, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: new Date().toISOString() },
  } as Session;
}

function mockAuth(start: Session | null = null): AuthApi & {
  lastOtp: { email: string; options?: { shouldCreateUser?: boolean; emailRedirectTo?: string } } | null;
  lastVerify: { email: string; token: string; type: string } | null;
} {
  let session = start;
  const listeners: Array<(event: string, session: Session | null) => void> = [];
  const api: AuthApi & {
    lastOtp: { email: string; options?: { shouldCreateUser?: boolean; emailRedirectTo?: string } } | null;
    lastVerify: { email: string; token: string; type: string } | null;
  } = {
    lastOtp: null,
    lastVerify: null,
    auth: {
      async getSession() {
        return { data: { session }, error: null };
      },
      async signInWithOtp({ email, options }) {
        api.lastOtp = { email, options };
        return { error: null };
      },
      async verifyOtp({ token, email, type }) {
        api.lastVerify = { email, token, type };
        if (token !== "123456") return { error: { message: "Invalid login credentials" } };
        session = fakeSession(email);
        listeners.forEach((l) => l("SIGNED_IN", session));
        return { error: null };
      },
      async signOut() {
        session = null;
        listeners.forEach((l) => l("SIGNED_OUT", null));
        return { error: null };
      },
      onAuthStateChange(cb) {
        listeners.push(cb);
        queueMicrotask(() => cb("INITIAL_SESSION", session));
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  return api;
}

describe("magic-link accounts", () => {
  it("keeps supabase-js persistence flags on", () => {
    expect(AUTH_CLIENT_OPTIONS).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
      storageKey: "slide.auth.v1",
    });
  });

  it("sends production magic links back to kings-slide.pages.dev", () => {
    expect(authRedirectUrl("https://kings-slide.pages.dev", "/")).toBe(`${AUTH_SITE_URL}/`);
    expect(authRedirectUrl("https://kings-slide.pages.dev", "/index.html")).toBe(`${AUTH_SITE_URL}/`);
    expect(authRedirectUrl("https://nard-verify-main.kings-slide.pages.dev", "/")).toBe("https://nard-verify-main.kings-slide.pages.dev/");
    expect(authRedirectUrl("http://localhost:5173", "/")).toBe(`${AUTH_SITE_URL}/`);
  });

  it("sign-up: anyone can create an account (shouldCreateUser) and get a link", async () => {
    const api = mockAuth();
    await sendMagicLink("new@slide.test", api, `${AUTH_SITE_URL}/`);
    expect(api.lastOtp).toEqual({
      email: "new@slide.test",
      options: { shouldCreateUser: true, emailRedirectTo: `${AUTH_SITE_URL}/` },
    });
  });

  it("normalizes a 6-digit email OTP and rejects junk", () => {
    expect(normalizeEmailOtp("123456")).toBe("123456");
    expect(normalizeEmailOtp(" 123 456 ")).toBe("123456");
    expect(normalizeEmailOtp("12345")).toBeNull();
    expect(normalizeEmailOtp("abcdef")).toBeNull();
    expect(normalizeEmailOtp("")).toBeNull();
  });

  it("sign-in: verifyOtp type email in this app creates the session", async () => {
    const api = mockAuth();
    await verifyMagicCode("king@slide.test", "123 456", api);
    expect(api.lastVerify).toEqual({ email: "king@slide.test", token: "123456", type: "email" });
    const user = await restoreSession(api);
    expect(user).toEqual({ id: "user-1", email: "king@slide.test" });
  });

  it("rejects a wrong or expired sign-in code", async () => {
    const api = mockAuth();
    await expect(verifyMagicCode("king@slide.test", "000000", api)).rejects.toThrow(/invalid login credentials/i);
    expect(await restoreSession(api)).toBeNull();
  });

  it("rejects a code that is not 6 digits before calling the server", async () => {
    const api = mockAuth();
    await expect(verifyMagicCode("king@slide.test", "12", api)).rejects.toThrow(/6-digit/i);
    expect(api.lastVerify).toBeNull();
  });

  it("restores the session after a reload (INITIAL_SESSION + getSession)", async () => {
    const saved = fakeSession("back@slide.test", "user-9");
    const api = mockAuth(saved);
    const user = await listenAuthState(api);
    expect(user).toEqual({ id: "user-9", email: "back@slide.test" });
    const again = mockAuth(saved);
    expect(await restoreSession(again)).toEqual({ id: "user-9", email: "back@slide.test" });
  });

  it("sign-out clears the session so the next load is signed out", async () => {
    const api = mockAuth(fakeSession("out@slide.test"));
    await restoreSession(api);
    await signOutAccount(api);
    expect(await restoreSession(api)).toBeNull();
  });
});
