import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Slide's one optional server: Supabase, for accounts, follows and driver
 * reports. Configured at build time from Cloudflare Pages environment
 * variables (never committed):
 *   VITE_SUPABASE_URL          https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY     the project's publishable/anon key (public by design; RLS protects data)
 * Without them the app runs exactly as before: everything on-device, social off.
 * The client is loaded on first use so it never slows the first paint.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function cloudConfigured(): boolean {
  return Boolean(URL_ && KEY);
}

let client: Promise<SupabaseClient> | null = null;

export function cloud(): Promise<SupabaseClient> {
  if (!cloudConfigured()) return Promise.reject(new Error("Slide accounts aren't set up on this build yet."));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_!, KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "slide.auth.v1", detectSessionInUrl: false },
    })
  );
  return client;
}
