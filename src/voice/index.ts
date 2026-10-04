import type { Step } from "../lib/guidance";
import { AnnounceTracker, upcomingCue } from "./announce";
import { isMuted, listenVoiceMute, onMuteChange, syncMutedFromDom } from "./mute";
import { cancelSpeech, primeSpeech, speak } from "./speech";

if (typeof window !== "undefined") listenVoiceMute();
onMuteChange(() => {
  if (isMuted()) cancelSpeech();
});

export { AnnounceTracker, dueThreshold, upcomingCue, voicePhrase } from "./announce";
export {
  applyMuteState,
  isMuted,
  listenVoiceMute,
  loadVoice,
  parseVoiceMuteEvent,
  parseVoiceSettings,
  syncMutedFromDom,
  voiceAttrMuted,
  VOICE_KEY,
} from "./mute";
export { cancelSpeech, pickEnglishVoice, primeSpeech, speak } from "./speech";

const tracker = new AnnounceTracker();

/** Call from the Go now tap so iOS unlocks speechSynthesis. Re-reads `html[data-voice]`. */
export function startVoice(): void {
  tracker.reset();
  syncMutedFromDom();
  primeSpeech();
}

/** New line (reroute). Drop queued prompts for the old maneuvers. */
export function resetVoice(): void {
  tracker.reset();
  cancelSpeech();
}

/** End / arrival: stop talking and forget the trip. */
export function stopVoice(): void {
  tracker.reset();
  cancelSpeech();
}

/** Drive loop: speak the next due prompt for the real upcoming maneuver. */
export function tickVoice(steps: Step[], progressMi: number): void {
  if (isMuted()) return;
  const cue = upcomingCue(steps, progressMi);
  if (!cue) return;
  const phrase = tracker.next(cue.id, cue.distanceMi, cue.verbal);
  if (phrase) speak(phrase);
}
