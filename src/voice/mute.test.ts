import { describe, expect, it } from "vitest";
import { parseVoiceMuteEvent, parseVoiceSettings, voiceAttrMuted } from "./mute";

describe("parseVoiceSettings", () => {
  it("defaults to voice on", () => {
    expect(parseVoiceSettings(null)).toEqual({ muted: false });
    expect(parseVoiceSettings("{")).toEqual({ muted: false });
    expect(parseVoiceSettings("{}")).toEqual({ muted: false });
  });

  it("only treats muted:true as off", () => {
    expect(parseVoiceSettings('{"muted":true}')).toEqual({ muted: true });
    expect(parseVoiceSettings('{"muted":false}')).toEqual({ muted: false });
    expect(parseVoiceSettings('{"muted":"yes"}')).toEqual({ muted: false });
  });
});

describe("Grim mute contract", () => {
  it("reads html[data-voice] as muted | on", () => {
    const html = { dataset: { voice: "on" } } as unknown as HTMLElement;
    expect(voiceAttrMuted(html)).toBe(false);
    html.dataset.voice = "muted";
    expect(voiceAttrMuted(html)).toBe(true);
    html.dataset.voice = "";
    expect(voiceAttrMuted(html)).toBe(false);
  });

  it("reads slide:voice-mute { muted }", () => {
    expect(parseVoiceMuteEvent({ muted: true })).toBe(true);
    expect(parseVoiceMuteEvent({ muted: false })).toBe(false);
    expect(parseVoiceMuteEvent({ muted: "yes" })).toBe(false);
    expect(parseVoiceMuteEvent(null)).toBeNull();
    expect(parseVoiceMuteEvent({})).toBeNull();
  });
});
