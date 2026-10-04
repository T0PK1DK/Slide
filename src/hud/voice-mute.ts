/**
 * Drive mute control. Toggles a shared flag Nard can hook for speechSynthesis.
 * Does not speak. Event: `slide:voice-mute` with `{ muted }`.
 */
const KEY = "slide.voiceMuted";

export function voiceMuted(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function mountVoiceMute(el: HTMLButtonElement): void {
  const apply = (muted: boolean) => {
    el.setAttribute("aria-pressed", String(muted));
    el.dataset.muted = muted ? "1" : "0";
    document.documentElement.dataset.voice = muted ? "muted" : "on";
    el.setAttribute("aria-label", muted ? "Unmute voice guidance" : "Mute voice guidance");
    el.innerHTML = muted
      ? `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4zm15.5 2l2.5 2.5M17 14.5L19.5 12M17 9.5L21.5 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4zm12.5 2a4 4 0 0 0-2-3.5M18 12a6 6 0 0 0-3-5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    window.dispatchEvent(new CustomEvent("slide:voice-mute", { detail: { muted } }));
  };
  el.addEventListener("click", () => {
    const next = el.getAttribute("aria-pressed") !== "true";
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* private mode */ }
    apply(next);
  });
  apply(voiceMuted());
}
