import { describe, expect, it } from "vitest";
import {
  TEST_CLOUD_USER,
  TEST_EMAIL,
  TEST_USER_ID,
  TEST_USERNAME,
  authEnabled,
  parseAuthEnabled,
} from "./auth-config";

describe("auth flag", () => {
  it("is off unless the env value is an explicit on-switch", () => {
    expect(parseAuthEnabled(undefined)).toBe(false);
    expect(parseAuthEnabled(null)).toBe(false);
    expect(parseAuthEnabled("")).toBe(false);
    expect(parseAuthEnabled("false")).toBe(false);
    expect(parseAuthEnabled("0")).toBe(false);
    expect(parseAuthEnabled("off")).toBe(false);
    expect(parseAuthEnabled(false)).toBe(false);
    expect(parseAuthEnabled("true")).toBe(true);
    expect(parseAuthEnabled("TRUE")).toBe(true);
    expect(parseAuthEnabled("1")).toBe(true);
    expect(parseAuthEnabled(true)).toBe(true);
  });

  it("defaults off in this build (VITE_AUTH_ENABLED unset or not true)", () => {
    expect(authEnabled()).toBe(false);
  });
});

describe("built-in test identity", () => {
  it("is a stable UUID-shaped id with a username, never a password", () => {
    expect(TEST_USER_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(TEST_USERNAME).toBe("slide_test");
    expect(TEST_EMAIL).toBe("slide_test@users.slide.local");
    expect(TEST_CLOUD_USER).toEqual({
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      username: TEST_USERNAME,
    });
    expect(JSON.stringify(TEST_CLOUD_USER)).not.toMatch(/password/i);
  });
});
