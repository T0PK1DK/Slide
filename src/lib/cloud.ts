import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_STORAGE_KEY, authStorage } from "./auth-storage";

/**
 * Slide's one optional server: Supabase, for accounts, follows and driver
 * reports. Configured at build time from `.env.production` or the shell
 * (kings-slide is a Direct Upload Pages project, so the build runs locally):
 *   VITE_SUPABASE_URL          https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY     the project's publishable/anon key (public by design; RLS protects data)
 * Without them the app runs exactly as before: everything on-device, social off.
 * The client is loaded on first use so it never slows the first paint.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Production origin. Magic-link returns must land here (or a pages.dev preview). */
export const AUTH_SITE_URL = "https://kings-slide.pages.dev";

/**
 * Pure: is this page load a return from the emailed sign-in link? Supabase sends
 * the driver back with tokens in the hash (`#access_token=…`, implicit flow), a
 * `?code=` (PKCE), or an error (`#error=…&error_description=…`).
 */
export function authReturn(hash: string, search: string): { kind: "session" } | { kind: "error"; message: string } | null {
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  const err = h.get("error_description") ?? q.get("error_description") ?? h.get("error") ?? q.get("error");
  if (err) return { kind: "error", message: err.replace(/\+/g, " ") };
  if (h.get("access_token") || q.get("code")) return { kind: "session" };
  return null;
}

/**
 * Where the emailed link should send the driver. Production always uses the
 * live Pages origin so the session cookie is written on the same host as the
 * Home Screen app. Previews keep their own origin (PKCE / cookies are
 * host-bound). Local http falls back to the live site URL for docs/tests.
 */
export function authRedirectUrl(origin = "", pathname = "/"): string {
  try {
    const u = new URL(origin);
    if (u.hostname === "kings-slide.pages.dev") return `${AUTH_SITE_URL}/`;
    if (u.hostname.endsWith(".kings-slide.pages.dev") && u.protocol === "https:") return `${u.origin}/`;
    if (u.protocol === "https:") return `${u.origin}${pathname || "/"}`;
  } catch {
    /* ignore */
  }
  return `${AUTH_SITE_URL}/`;
}

export function cloudConfigured(): boolean {
  return Boolean(URL_ && KEY);
}

/** Flags supabase-js needs so a session survives reload, Safari, and the PWA. */
export const AUTH_CLIENT_OPTIONS = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: "implicit" as const,
  storageKey: AUTH_STORAGE_KEY,
};

let client: Promise<SupabaseClient> | null = null;

export function cloud(): Promise<SupabaseClient> {
  if (!cloudConfigured()) return Promise.reject(new Error("Slide accounts aren't set up on this build yet."));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_!, KEY!, {
      auth: {
        ...AUTH_CLIENT_OPTIONS,
        storage: authStorage,
      },
    })
  );
  return client;
}
