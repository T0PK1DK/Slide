/**
 * Auth switch + the built-in test driver used when sign-in is off.
 *
 * `VITE_AUTH_ENABLED` is off unless it is the string `true` or `1`. That is
 * intentional: King wants the app to open straight into the HUD. Existing
 * username + password code stays in `account.ts` / `hud/login.ts` and comes
 * back when the flag is turned on at build time.
 *
 * The test identity is a stable local UUID + handle. It is not a password and
 * not a Supabase JWT. See docs/TEST_ACCOUNT_DATA.md.
 */

/** Well-known local test user. UUID-shaped so it can filter the same columns as auth.uid(). */
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_USERNAME = "slide_test";
export const TEST_DISPLAY_NAME = "Test Driver";
export const TEST_TAG = "SLIDE-01";
export const TEST_EMAIL = `${TEST_USERNAME}@users.slide.local`;

export type TestCloudUser = { id: string; email: string; username: string };

export const TEST_CLOUD_USER: TestCloudUser = {
  id: TEST_USER_ID,
  email: TEST_EMAIL,
  username: TEST_USERNAME,
};

/** Pure: treat only an explicit on-switch as enabled. Missing / false / 0 stay off. */
export function parseAuthEnabled(raw: string | boolean | undefined | null): boolean {
  if (raw === true) return true;
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1";
}

/** Build-time: username + password sign-in. Default off. */
export function authEnabled(): boolean {
  return parseAuthEnabled(import.meta.env.VITE_AUTH_ENABLED);
}
