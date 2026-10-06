/**
 * Supabase auth storage that survives iPhone Safari and the Home Screen app.
 *
 * Those two contexts do not share localStorage. They do share first-party
 * cookies on kings-slide.pages.dev. Every write goes to both; a read prefers
 * localStorage and falls back to the cookie so a sign-in in Safari
 * is still there when the driver opens the installed app (where the cookie is shared).
 *
 * Cookies are first-party, Secure (on https), SameSite=Lax, Path=/, 90 days.
 * They are readable by JS on purpose: supabase-js has to persist and refresh
 * the session. They are not HttpOnly.
 */

export const AUTH_STORAGE_KEY = "slide.auth.v1";
export const AUTH_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;
const CHUNK = 3500;

export type AuthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type StorageHost = {
  getLocal: (key: string) => string | null;
  setLocal: (key: string, value: string) => void;
  removeLocal: (key: string) => void;
  getCookie: () => string;
  setCookie: (value: string) => void;
  secure: boolean;
};

function browserHost(): StorageHost {
  return {
    getLocal: (key) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setLocal: (key, value) => {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* private mode / full */
      }
    },
    removeLocal: (key) => {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    getCookie: () => (typeof document !== "undefined" ? document.cookie : ""),
    setCookie: (value) => {
      if (typeof document !== "undefined") document.cookie = value;
    },
    secure: typeof location !== "undefined" && location.protocol === "https:",
  };
}

/** Cookie-safe name for a supabase-js storage key (session, PKCE verifier, …). */
export function cookieName(key: string, part = 0): string {
  const base = key.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48);
  return part === 0 ? base : `${base}_${part}`;
}

function cookieFlags(host: StorageHost): string {
  return `; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${host.secure ? "; Secure" : ""}`;
}

function expireFlags(host: StorageHost): string {
  return `; Path=/; Max-Age=0; SameSite=Lax${host.secure ? "; Secure" : ""}`;
}

function readCookie(host: StorageHost, name: string): string | null {
  const parts = host.getCookie().split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(p.slice(name.length + 1));
      } catch {
        return p.slice(name.length + 1);
      }
    }
  }
  return null;
}

function writeChunks(host: StorageHost, key: string, value: string | null) {
  for (let i = 0; i < 8; i++) {
    const existing = readCookie(host, cookieName(key, i));
    if (existing === null && i > 0) break;
    host.setCookie(`${cookieName(key, i)}=${expireFlags(host)}`);
  }
  if (value === null || value === "") return;
  for (let i = 0, part = 0; i < value.length; i += CHUNK, part++) {
    const slice = encodeURIComponent(value.slice(i, i + CHUNK));
    host.setCookie(`${cookieName(key, part)}=${slice}${cookieFlags(host)}`);
  }
}

function readChunks(host: StorageHost, key: string): string | null {
  const first = readCookie(host, cookieName(key, 0));
  if (first === null) return null;
  let out = first;
  for (let i = 1; i < 8; i++) {
    const next = readCookie(host, cookieName(key, i));
    if (next === null) break;
    out += next;
  }
  return out;
}

export function createAuthStorage(host: StorageHost = browserHost()): AuthStorage {
  return {
    getItem(key) {
      return host.getLocal(key) ?? readChunks(host, key);
    },
    setItem(key, value) {
      host.setLocal(key, value);
      writeChunks(host, key, value);
    },
    removeItem(key) {
      host.removeLocal(key);
      writeChunks(host, key, null);
    },
  };
}

const defaultStorage = createAuthStorage();

/** The adapter passed to supabase-js. */
export const authStorage: AuthStorage = {
  getItem: (key) => defaultStorage.getItem(key),
  setItem: (key, value) => defaultStorage.setItem(key, value),
  removeItem: (key) => defaultStorage.removeItem(key),
};

/** Drop every auth cookie (session + PKCE slots) after sign-out or erase. */
export function clearAuthCookies(host: StorageHost = browserHost()) {
  const names = new Set<string>();
  for (const part of host.getCookie().split(";")) {
    const name = part.trim().split("=")[0];
    if (name.startsWith("slide_auth")) names.add(name);
  }
  for (const name of names) host.setCookie(`${name}=${expireFlags(host)}`);
}

export function clearAuthStorage() {
  authStorage.removeItem(AUTH_STORAGE_KEY);
  authStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  authStorage.removeItem(`${AUTH_STORAGE_KEY}-flows-code-verifier`);
  clearAuthCookies();
}
