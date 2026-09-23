/**
 * On-device driver profile. There is no server: the "account" lives in this
 * browser's storage, so a tester's garage, places and ghosts stay on their phone
 * (HANDOFF rule 4). The PIN is a local lock to keep a friend's phone from
 * opening straight into your drives — it is not security against someone with
 * the device and dev tools.
 */
export type DriverProfile = {
  name: string;
  tag: string;
  pinHash: string | null;
  createdAt: number;
  lastSeen: number;
};

const PROFILE_KEY = "slide.profile.v1";
const SESSION_KEY = "slide.session.v1";

export function loadProfile(): DriverProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<DriverProfile>;
    if (typeof p.name !== "string" || !p.name) return null;
    return {
      name: p.name,
      tag: typeof p.tag === "string" && p.tag ? p.tag : "SLIDE-01",
      pinHash: typeof p.pinHash === "string" ? p.pinHash : null,
      createdAt: p.createdAt ?? Date.now(),
      lastSeen: p.lastSeen ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveProfile(p: DriverProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // Private mode or full storage: the session still works until the tab closes.
  }
}

/** Signed in stays on until the driver locks the app, so a returning tester opens straight in. */
export function isSignedIn(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSignedIn(on: boolean) {
  try {
    if (on) localStorage.setItem(SESSION_KEY, "on");
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore; see saveProfile.
  }
}

export function touchProfile(p: DriverProfile): DriverProfile {
  const next = { ...p, lastSeen: Date.now() };
  saveProfile(next);
  return next;
}

/** Removes the profile and every `slide.*` key: garage, places, recents, ghosts. */
export function eraseDeviceData() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("slide.")) localStorage.removeItem(k);
    }
  } catch {
    // Nothing to erase.
  }
}

export async function hashPin(pin: string): Promise<string> {
  const salted = `slide:${pin}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salted));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-secure context (plain http on a LAN IP): a weak local fallback is still better than plaintext.
  let h = 0;
  for (const c of salted) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return `w${(h >>> 0).toString(16)}`;
}

/**
 * Asks the browser not to evict our storage under pressure. iOS Safari still
 * clears site data after ~7 days unused unless the app is on the Home Screen,
 * which is why the login screen suggests adding it.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}
