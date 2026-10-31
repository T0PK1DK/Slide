import { useLocalUser } from "./account";
import { TEST_CLOUD_USER, TEST_DISPLAY_NAME, TEST_TAG } from "./auth-config";
import { loadProfile, saveProfile, setSignedIn, touchProfile, type DriverProfile } from "./profile";

/**
 * Bind every per-account local key (profile, garage, history, ghosts, XP)
 * to the built-in test driver. Sync — call this before `loadGarage()` so the
 * first paint already reads the scoped keys.
 */
export function installTestAccount() {
  useLocalUser(TEST_CLOUD_USER);
}

/** Create the on-device driver card if this phone has never seen the test user. */
export function ensureTestProfile(): DriverProfile {
  const existing = loadProfile();
  if (existing) {
    setSignedIn(true);
    return touchProfile(existing);
  }
  const now = Date.now();
  const profile: DriverProfile = {
    name: TEST_DISPLAY_NAME,
    tag: TEST_TAG,
    pinHash: null,
    createdAt: now,
    lastSeen: now,
    car: null,
  };
  saveProfile(profile);
  setSignedIn(true);
  return profile;
}

/** Install the test user and return the driver card. No login DOM. */
export function enterAsTestDriver(): DriverProfile {
  installTestAccount();
  return ensureTestProfile();
}
