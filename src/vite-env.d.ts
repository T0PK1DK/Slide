/// <reference types="vite/client" />

/** Short commit + ISO build time, injected by vite.config.ts. */
declare const __SLIDE_BUILD__: { sha: string; builtAt: string };

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** `"true"` or `"1"` restores username + password sign-in. Default off. */
  readonly VITE_AUTH_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
