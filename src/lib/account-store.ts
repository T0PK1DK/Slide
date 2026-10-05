/**
 * Per-account local keys. Home, work (garage), trip history, ghosts and XP
 * stay on the phone, but they are stored under the signed-in user so a second
 * driver on the same phone does not see the first driver's places.
 *
 * Reports stay on the server and are already scoped by auth.uid() (RLS).
 */

export const PRIVATE_KEYS = [
  "slide.profile.v1",
  "slide.session.v1",
  "slide.garage.v1",
  "slide.history.v1",
  "slide.ghosts.v1",
  "slide.xp.v1",
] as const;

export type PrivateKey = (typeof PRIVATE_KEYS)[number];

let owner: string | null = null;

export function accountOwner(): string | null {
  return owner;
}

/** Storage key for this account. Unsigned loads use the original device key. */
export function scopedKey(base: string): string {
  return owner ? `${base}.${owner}` : base;
}

export type KeyStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function browserStore(): KeyStore {
  return {
    getItem: (key) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* private mode / full */
      }
    },
  };
}

/**
 * Bind local private data to this user. On first sign-in, copies any
 * unscoped device values into the user keys so testers keep Home / Work.
 */
export function setAccountOwner(userId: string | null, store: KeyStore = browserStore()) {
  owner = userId && userId.trim() ? userId.trim() : null;
  if (!owner) return;
  for (const base of PRIVATE_KEYS) {
    const dest = `${base}.${owner}`;
    if (store.getItem(dest)) continue;
    const from = store.getItem(base);
    if (from) store.setItem(dest, from);
  }
}
