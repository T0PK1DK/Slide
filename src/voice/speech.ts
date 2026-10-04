import { isMuted } from "./mute";

function synth(): SpeechSynthesis | null {
  try {
    if (typeof speechSynthesis === "undefined") return null;
    return speechSynthesis;
  } catch {
    return null;
  }
}

/** Prefer a US English voice; any `en-*` beats a non-English default. */
export function pickEnglishVoice(voices: SpeechSynthesisVoice[] = synth()?.getVoices() ?? []): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  return (
    en.find((v) => /^en-US/i.test(v.lang) && v.localService) ||
    en.find((v) => /^en-US/i.test(v.lang)) ||
    en.find((v) => v.default) ||
    en[0]
  );
}

function applyEnglish(u: SpeechSynthesisUtterance): void {
  const voice = pickEnglishVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = "en-US";
  }
}

/**
 * iOS Safari only unlocks speechSynthesis from a user gesture. Call this
 * synchronously from Go now. No-ops when the API is missing.
 */
export function primeSpeech(): void {
  const s = synth();
  if (!s) return;
  try {
    void s.getVoices();
    const listen = s.addEventListener?.bind(s);
    if (listen) listen("voiceschanged", () => void s.getVoices(), { once: true });
    else s.onvoiceschanged = () => void s.getVoices();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.rate = 1;
    applyEnglish(u);
    s.speak(u);
  } catch {
    // Private mode, missing voices, or an older WebKit — stay quiet.
  }
}

let speakTimer = 0;

/** Speak one prompt. Cancels whatever was still queued so "now" wins. */
export function speak(text: string): void {
  const s = synth();
  const phrase = text.trim();
  if (!s || !phrase || isMuted()) return;
  if (speakTimer) window.clearTimeout(speakTimer);
  try {
    s.cancel();
  } catch {
    /* ignore */
  }
  const u = new SpeechSynthesisUtterance(phrase);
  u.rate = 1;
  applyEnglish(u);
  // cancel() then speak() in the same turn can drop the new utterance on WebKit.
  speakTimer = window.setTimeout(() => {
    speakTimer = 0;
    if (isMuted()) return;
    try {
      s.speak(u);
    } catch {
      /* ignore */
    }
  }, 40);
}

export function cancelSpeech(): void {
  if (speakTimer) {
    window.clearTimeout(speakTimer);
    speakTimer = 0;
  }
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}
