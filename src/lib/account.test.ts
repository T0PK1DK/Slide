import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import {
  accountLabel,
  CONFIRM_EMAIL_ON,
  friendlyAuthError,
  listenAuthState,
  normalizeUsername,
  passwordProblem,
  restoreSession,
  signInWithUsername,
  signOutAccount,
  signUpWithUsername,
  USERNAME_EMAIL_DOMAIN,
  usernameFromEmail,
  usernameToEmail,
  type AuthApi,
} from "./account";

function fakeSession(email: string, id = "user-1", meta: Record<string, unknown> = {}): Session {
  return {
    access_token: "tok",
    refresh_token: "ref",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id, email, app_metadata: {}, user_metadata: meta, aud: "authenticated", created_at: new Date().toISOString() },
  } as Session;
}

type Calls = {
  signUps: Array<{ email: string; password: string; options?: { data?: Record<string, unknown> } }>;
  signIns: Array<{ email: string; password: string }>;
};

/** A tiny in-memory GoTrue: `confirmEmail` mimics Supabase's "Confirm email" switch. */
function mockAuth(start: Session | null = null, opts: { confirmEmail?: boolean } = {}): AuthApi & Calls {
  let session = start;
  const users = new Map<string, { id: string; password: string }>();
  const listeners: Array<(event: string, session: Session | null) => void> = [];
  const api: AuthApi & Calls = {
    signUps: [],
    signIns: [],
    auth: {
      async getSession() {
        return { data: { session }, error: null };
      },
      async signUp(creds) {
        api.signUps.push(creds);
        if (users.has(creds.email)) {
          if (opts.confirmEmail) return { data: { session: null, user: { identities: [] } as unknown as Session["user"] }, error: null };
          return { data: { session: null, user: null }, error: { message: "User already registered", code: "user_already_exists", status: 422 } };
        }
        const id = `user-${users.size + 1}`;
        users.set(creds.email, { id, password: creds.password });
        if (opts.confirmEmail) return { data: { session: null, user: { id, identities: [{}] } as unknown as Session["user"] }, error: null };
        session = fakeSession(creds.email, id, creds.options?.data ?? {});
        listeners.forEach((l) => l("SIGNED_IN", session));
        return { data: { session, user: session.user }, error: null };
      },
      async signInWithPassword(creds) {
        api.signIns.push(creds);
        const u = users.get(creds.email);
        if (!u || u.password !== creds.password) {
          return { data: { session: null }, error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 } };
        }
        session = fakeSession(creds.email, u.id);
        listeners.forEach((l) => l("SIGNED_IN", session));
        return { data: { session }, error: null };
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

describe("username validation", () => {
  it("accepts 3–20 letters, numbers or underscores and lowercases them", () => {
    expect(normalizeUsername("King")).toBe("king");
    expect(normalizeUsername("  slide_01 ")).toBe("slide_01");
    expect(normalizeUsername("@KingSlides")).toBe("kingslides");
    expect(normalizeUsername("abc")).toBe("abc");
    expect(normalizeUsername("a".repeat(20))).toBe("a".repeat(20));
  });

  it("rejects too short, too long, spaces, symbols and emails", () => {
    expect(normalizeUsername("ab")).toBeNull();
    expect(normalizeUsername("a".repeat(21))).toBeNull();
    expect(normalizeUsername("king slides")).toBeNull();
    expect(normalizeUsername("king-slides")).toBeNull();
    expect(normalizeUsername("king.slides")).toBeNull();
    expect(normalizeUsername("king@gmail.com")).toBeNull();
    expect(normalizeUsername("kíng")).toBeNull();
    expect(normalizeUsername("")).toBeNull();
  });

  it("passwords need 8–72 characters", () => {
    expect(passwordProblem("1234567")).toMatch(/at least 8/);
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("x".repeat(72))).toBeNull();
    expect(passwordProblem("x".repeat(73))).toMatch(/at most 72/);
  });
});

describe("username ↔ synthetic email mapping", () => {
  it("maps a username to <username>@users.slide.local", () => {
    expect(USERNAME_EMAIL_DOMAIN).toBe("users.slide.local");
    expect(usernameToEmail("King_01")).toBe("king_01@users.slide.local");
    expect(usernameToEmail("no way")).toBeNull();
  });

  it("maps it back, and leaves real (older) email accounts alone", () => {
    expect(usernameFromEmail("king_01@users.slide.local")).toBe("king_01");
    expect(usernameFromEmail("KING_01@USERS.SLIDE.LOCAL")).toBe("king_01");
    expect(usernameFromEmail("king@gmail.com")).toBeNull();
    expect(usernameFromEmail("king@evil.users.slide.local.com")).toBeNull();
    expect(usernameFromEmail(null)).toBeNull();
  });

  it("shows the username, never the fake email", () => {
    expect(accountLabel({ id: "1", email: "king@users.slide.local", username: "king" })).toBe("@king");
    expect(accountLabel({ id: "1", email: "old@gmail.com", username: null })).toBe("old@gmail.com");
    expect(accountLabel(null)).toBeNull();
  });
});

describe("username + password accounts", () => {
  it("create account: signUp with the synthetic email, signs straight in", async () => {
    const api = mockAuth();
    const user = await signUpWithUsername("King", "hunter2hunter2", api);
    expect(api.signUps[0]).toEqual({
      email: "king@users.slide.local",
      password: "hunter2hunter2",
      options: { data: { username: "king" } },
    });
    expect(user).toEqual({ id: "user-1", email: "king@users.slide.local", username: "king" });
    expect(await restoreSession(api)).toEqual(user);
  });

  it("taken username gets a clear message", async () => {
    const api = mockAuth();
    await signUpWithUsername("king", "hunter2hunter2", api);
    await expect(signUpWithUsername("KING", "another-password", api)).rejects.toThrow(/username is taken/i);
  });

  it("sign in: right password works, wrong password says so", async () => {
    const api = mockAuth();
    await signUpWithUsername("king", "hunter2hunter2", api);
    await signOutAccount(api);
    await expect(signInWithUsername("king", "wrong-password", api)).rejects.toThrow(/wrong username or password/i);
    expect(await restoreSession(api)).toBeNull();
    const user = await signInWithUsername(" King ", "hunter2hunter2", api);
    expect(api.signIns.at(-1)).toEqual({ email: "king@users.slide.local", password: "hunter2hunter2" });
    expect(user.username).toBe("king");
  });

  it("unknown username reads the same as a wrong password", async () => {
    await expect(signInWithUsername("nobody_here", "whatever123", mockAuth())).rejects.toThrow(/wrong username or password/i);
  });

  it("validates before calling the server", async () => {
    const api = mockAuth();
    await expect(signUpWithUsername("ab", "hunter2hunter2", api)).rejects.toThrow(/3–20/);
    await expect(signUpWithUsername("king", "short", api)).rejects.toThrow(/at least 8/);
    await expect(signInWithUsername("no spaces", "hunter2hunter2", api)).rejects.toThrow(/3–20/);
    await expect(signInWithUsername("king", "", api)).rejects.toThrow(/password/i);
    expect(api.signUps).toHaveLength(0);
    expect(api.signIns).toHaveLength(0);
  });

  it("explains the Supabase switch if 'Confirm email' is still on", async () => {
    const api = mockAuth(null, { confirmEmail: true });
    await expect(signUpWithUsername("king", "hunter2hunter2", api)).rejects.toThrow(CONFIRM_EMAIL_ON);
    expect(await restoreSession(api)).toBeNull();
    expect(friendlyAuthError({ message: "Email not confirmed", code: "email_not_confirmed" }, "in")).toBe(CONFIRM_EMAIL_ON);
    expect(friendlyAuthError({ message: 'Email address "king@users.slide.local" is invalid', code: "email_address_invalid" }, "up")).toBe(CONFIRM_EMAIL_ON);
  });

  it("restores the session after a reload (INITIAL_SESSION + getSession)", async () => {
    const saved = fakeSession("back@users.slide.local", "user-9");
    const user = await listenAuthState(mockAuth(saved));
    expect(user).toEqual({ id: "user-9", email: "back@users.slide.local", username: "back" });
    expect(await restoreSession(mockAuth(saved))).toEqual(user);
  });

  it("an older email account still restores, labelled by its email", async () => {
    const saved = fakeSession("old@gmail.com", "user-7");
    expect(await restoreSession(mockAuth(saved))).toEqual({ id: "user-7", email: "old@gmail.com", username: null });
  });

  it("sign-out clears the session so the next load is signed out", async () => {
    const api = mockAuth(fakeSession("out@users.slide.local"));
    await restoreSession(api);
    await signOutAccount(api);
    expect(await restoreSession(api)).toBeNull();
  });
});
