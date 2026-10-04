import type { SupabaseClient } from "@supabase/supabase-js";

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

export function cloudConfigured(): boolean {
  return Boolean(URL_ && KEY);
}

let client: Promise<SupabaseClient> | null = null;

export function cloud(): Promise<SupabaseClient> {
  if (!cloudConfigured()) return Promise.reject(new Error("Slide accounts aren't set up on this build yet."));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "slide.auth.v1",
        // Read the session from the URL only when this load is a return from the email link.
        detectSessionInUrl: authReturn(location.hash, location.search)?.kind === "session",
      },
    })
  );
  return client;
}
