import { describe, expect, it } from "vitest";
import { AUTH_CLIENT_OPTIONS } from "./cloud";

describe("supabase client options", () => {
  it("keeps sessions on this phone and refreshes them", () => {
    expect(AUTH_CLIENT_OPTIONS).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "slide.auth.v1",
    });
  });
  it("does not read sessions out of the URL (no emailed links any more)", () => {
    expect(AUTH_CLIENT_OPTIONS.detectSessionInUrl).toBe(false);
  });
});
