/** Mirrors Grim's mute flag. Grim owns `#drive-mute` and `slide.voiceMuted`. */
export const VOICE_KEY = "slide.voice.v1";

export type VoiceSettings = { muted: boolean };

const listeners = new Set<() => void>();
let muted = false;

export function parseVoiceSettings(raw: string | null): VoiceSettings {
  if (!raw) return { muted: false };
  try {
    const p = JSON.parse(raw) as Partial<VoiceSettings>;
    return { muted: p.muted === true };
  } catch {
    return { muted: false };
  }
}

/** Grim writes `html[data-voice]` as `on` | `muted`. */
export function voiceAttrMuted(root: HTMLElement | null | undefined = typeof document === "undefined" ? null : document.documentElement): boolean {
  return root?.dataset.voice === "muted";
}

/** `slide:voice-mute` detail. Null when the payload is missing or malformed. */
export function parseVoiceMuteEvent(detail: unknown): boolean | null {
  if (!detail || typeof detail !== "object" || !("muted" in detail)) return null;
  return (detail as { muted: unknown }).muted === true;
}

function store(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function persistV1(next: boolean): void {
  try {
    store()?.setItem(VOICE_KEY, JSON.stringify({ muted: next }));
  } catch {
    /* quota / private mode */
  }
}

export function isMuted(): boolean {
  return muted;
}

export function loadVoice(): VoiceSettings {
  return { muted };
}

/** Write memory + `slide.voice.v1` from Grim's current flag. */
export function applyMuteState(next: boolean): void {
  muted = next;
  persistV1(next);
  for (const fn of listeners) fn();
}

/** Read `html[data-voice]` and keep `slide.voice.v1` in lockstep. */
export function syncMutedFromDom(): boolean {
  applyMuteState(voiceAttrMuted());
  return muted;
}

export function onMuteChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Follow Grim's `#drive-mute`. No click handler, no second button.
 * Initial event from `mountVoiceMute` is enough to seed state.
 */
export function listenVoiceMute(): void {
  syncMutedFromDom();
  window.addEventListener("slide:voice-mute", (e: Event) => {
    const next = parseVoiceMuteEvent((e as CustomEvent).detail);
    applyMuteState(next ?? voiceAttrMuted());
  });
}
