import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { currentCloudUser } from "./account";
import { accountOwner, scopedKey, setAccountOwner } from "./account-store";
import { TEST_DISPLAY_NAME, TEST_TAG, TEST_USER_ID } from "./auth-config";
import { currentUserId } from "./social";
import { enterAsTestDriver, installTestAccount } from "./test-account";
import { isSignedIn, loadProfile, saveProfile } from "./profile";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe("built-in test account", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: memStorage(), configurable: true });
    setAccountOwner(null);
  });
  afterEach(() => {
    setAccountOwner(null);
  });

  it("scopes private keys to the test user before any garage/history read", () => {
    installTestAccount();
    expect(accountOwner()).toBe(TEST_USER_ID);
    expect(currentCloudUser()?.id).toBe(TEST_USER_ID);
    expect(currentCloudUser()?.username).toBe("slide_test");
    expect(scopedKey("slide.history.v1")).toBe(`slide.history.v1.${TEST_USER_ID}`);
    expect(scopedKey("slide.garage.v1")).toBe(`slide.garage.v1.${TEST_USER_ID}`);
    expect(scopedKey("slide.profile.v1")).toBe(`slide.profile.v1.${TEST_USER_ID}`);
  });

  it("creates a stable driver card and stays signed in", () => {
    const first = enterAsTestDriver();
    expect(first.name).toBe(TEST_DISPLAY_NAME);
    expect(first.tag).toBe(TEST_TAG);
    expect(first.pinHash).toBeNull();
    expect(isSignedIn()).toBe(true);
    expect(loadProfile()?.name).toBe(TEST_DISPLAY_NAME);

    const again = enterAsTestDriver();
    expect(again.createdAt).toBe(first.createdAt);
    expect(again.name).toBe(TEST_DISPLAY_NAME);
  });

  it("keeps an edited name on the same test user (data features stay keyed)", () => {
    const p = enterAsTestDriver();
    saveProfile({ ...p, name: "King Test" });
    const next = enterAsTestDriver();
    expect(next.name).toBe("King Test");
    expect(accountOwner()).toBe(TEST_USER_ID);
  });

  it("exposes the test profile id to features that used to read the session user", async () => {
    installTestAccount();
    expect(await currentUserId()).toBe(TEST_USER_ID);
  });
});
