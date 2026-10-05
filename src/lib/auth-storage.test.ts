import { describe, expect, it } from "vitest";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_STORAGE_KEY,
  clearAuthCookies,
  cookieName,
  createAuthStorage,
  type StorageHost,
} from "./auth-storage";

function memHost(secure = true): StorageHost & { local: Record<string, string>; cookies: string[] } {
  const local: Record<string, string> = {};
  const cookies: string[] = [];
  return {
    local,
    cookies,
    getLocal: (k) => local[k] ?? null,
    setLocal: (k, v) => { local[k] = v; },
    removeLocal: (k) => { delete local[k]; },
    getCookie: () => cookies.join("; "),
    setCookie: (v) => {
      const nv = v.split(";")[0]?.trim() ?? "";
      const name = nv.split("=")[0] ?? "";
      const attrs = v.split(";").slice(1).map((a) => a.trim());
      if (attrs.some((a) => a === "Max-Age=0")) {
        const i = cookies.findIndex((c) => c.startsWith(`${name}=`));
        if (i >= 0) cookies.splice(i, 1);
        return;
      }
      const i = cookies.findIndex((c) => c.startsWith(`${name}=`));
      if (i >= 0) cookies[i] = nv;
      else cookies.push(nv);
    },
    secure,
  };
}

describe("auth storage (Safari + Home Screen)", () => {
  it("writes the session to localStorage and a 90-day SameSite=Lax cookie", () => {
    const host = memHost();
    const writes: string[] = [];
    const inner = host.setCookie;
    host.setCookie = (v) => { writes.push(v); inner(v); };
    const s = createAuthStorage(host);
    s.setItem(AUTH_STORAGE_KEY, '{"access_token":"abc","refresh_token":"r"}');
    expect(host.local[AUTH_STORAGE_KEY]).toContain("abc");
    expect(s.getItem(AUTH_STORAGE_KEY)).toContain("refresh_token");
    expect(writes.some((w) => w.includes("Max-Age=" + AUTH_COOKIE_MAX_AGE))).toBe(true);
    expect(writes.some((w) => w.includes("SameSite=Lax") && w.includes("Secure"))).toBe(true);
    expect(writes.some((w) => w.includes("HttpOnly"))).toBe(false);
  });

  it("restores from the cookie when localStorage is empty (Home Screen after Safari sign-in)", () => {
    const host = memHost();
    const s = createAuthStorage(host);
    s.setItem(AUTH_STORAGE_KEY, '{"refresh_token":"from-safari"}');
    delete host.local[AUTH_STORAGE_KEY];
    expect(s.getItem(AUTH_STORAGE_KEY)).toBe('{"refresh_token":"from-safari"}');
  });

  it("chunks a long session and reads it back", () => {
    const host = memHost();
    const s = createAuthStorage(host);
    const value = "x".repeat(8000);
    s.setItem(AUTH_STORAGE_KEY, value);
    expect(s.getItem(AUTH_STORAGE_KEY)).toBe(value);
    expect(host.cookies.length).toBeGreaterThan(1);
  });

  it("removeItem clears both stores", () => {
    const host = memHost();
    const s = createAuthStorage(host);
    s.setItem(AUTH_STORAGE_KEY, "keep");
    s.removeItem(AUTH_STORAGE_KEY);
    expect(s.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(host.local[AUTH_STORAGE_KEY]).toBeUndefined();
  });

  it("clearAuthCookies drops slide_auth* cookies", () => {
    const host = memHost();
    host.cookies.push("slide_auth_v1=abc", "other=1");
    clearAuthCookies(host);
    expect(host.cookies.join(" ")).not.toContain("slide_auth");
    expect(host.cookies.some((c) => c.startsWith("other="))).toBe(true);
  });

  it("names cookies without dots so Safari accepts them", () => {
    expect(cookieName(AUTH_STORAGE_KEY)).toBe("slide_auth_v1");
    expect(cookieName(AUTH_STORAGE_KEY, 2)).toBe("slide_auth_v1_2");
  });
});
