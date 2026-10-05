import { describe, expect, it } from "vitest";
import { migrateGarage } from "./garage";
import { fromTomTomRoute } from "./sources/tomtom";
import {
  alreadyKept,
  blockingKinds,
  canSpendRouteCalls,
  considerReroute,
  decidePrompt,
  dueForCheck,
  emptyRerouteMemory,
  incidentWhy,
  inCooldown,
  nearRemaining,
  newBlockingIncidents,
  promptCopy,
  recordRouteCalls,
  remainingCoords,
  rememberKeep,
  rerouteEnabled,
  REROUTE,
  routeFingerprint,
  sampleSupporting,
  saveThresholdSec,
  worthPrompt,
  type AltCandidate,
  type RerouteFlags,
} from "./reroute";

const ON: RerouteFlags = { configured: true, showTraffic: true, suggestReroute: true };
const miami: Array<[number, number]> = [
  [-80.1918, 25.7617],
  [-80.1918, 25.7700],
  [-80.1918, 25.7800],
  [-80.2000, 25.7900],
];

const flags = (over: Partial<RerouteFlags> = {}): RerouteFlags => ({ ...ON, ...over });

describe("rerouteEnabled", () => {
  it("stays off without a key, with live traffic off, or with the sub-toggle off", () => {
    expect(rerouteEnabled(flags())).toBe(true);
    expect(rerouteEnabled(flags({ configured: false }))).toBe(false);
    expect(rerouteEnabled(flags({ showTraffic: false }))).toBe(false);
    expect(rerouteEnabled(flags({ suggestReroute: false }))).toBe(false);
  });
});

describe("save threshold", () => {
  it("is max(3 min, 10% of remaining)", () => {
    expect(saveThresholdSec(600)).toBe(180);
    expect(saveThresholdSec(3600)).toBe(360);
    expect(saveThresholdSec(0)).toBe(180);
    expect(worthPrompt(900, 700, 900)).toBe(true);
    expect(worthPrompt(900, 780, 900)).toBe(false);
    expect(worthPrompt(3600, 3300, 3600)).toBe(false);
    expect(worthPrompt(3600, 3200, 3600)).toBe(true);
    expect(worthPrompt(900, 0, 900)).toBe(false);
  });
});

describe("decidePrompt", () => {
  const base = {
    remainingSec: 1200,
    currentLiveSec: 1200,
    altLiveSec: 900,
    altFingerprint: "alt-a",
    memory: emptyRerouteMemory(0),
    now: 60_000,
  };

  it("prompts when the alt is real and clears the bar", () => {
    expect(decidePrompt({ ...base, flags: ON }).reason).toBe("ok");
    expect(decidePrompt({ ...base, flags: ON }).prompt).toBe(true);
    expect(decidePrompt({ ...base, flags: ON }).saveSec).toBe(300);
  });

  it("is silent with no key or toggles off", () => {
    expect(decidePrompt({ ...base, flags: flags({ configured: false }) }).reason).toBe("no-key");
    expect(decidePrompt({ ...base, flags: flags({ showTraffic: false }) }).reason).toBe("off");
    expect(decidePrompt({ ...base, flags: flags({ suggestReroute: false }) }).reason).toBe("off");
  });

  it("refuses invented times and a Keep'd fingerprint", () => {
    expect(decidePrompt({ ...base, flags: ON, currentLiveSec: null }).reason).toBe("no-data");
    expect(decidePrompt({ ...base, flags: ON, altLiveSec: null }).reason).toBe("no-data");
    const kept = rememberKeep(emptyRerouteMemory(0), "alt-a", 1_000);
    expect(decidePrompt({ ...base, flags: ON, memory: kept, now: 2_000 }).reason).toBe("kept");
  });

  it("honours the 5 min cooldown after Keep", () => {
    const kept = rememberKeep(emptyRerouteMemory(0), "other", 10_000);
    expect(inCooldown(kept, 10_000 + REROUTE.COOLDOWN_MS - 1)).toBe(true);
    expect(decidePrompt({ ...base, flags: ON, altFingerprint: "fresh", memory: kept, now: 10_000 + 60_000 }).reason).toBe("cooldown");
    expect(decidePrompt({ ...base, flags: ON, altFingerprint: "fresh", memory: kept, now: 10_000 + REROUTE.COOLDOWN_MS }).reason).toBe("ok");
  });

  it("does not re-prompt the same alternative after Keep even after cooldown", () => {
    const kept = rememberKeep(emptyRerouteMemory(0), "alt-a", 10_000);
    expect(alreadyKept(kept, "alt-a")).toBe(true);
    expect(decidePrompt({ ...base, flags: ON, memory: kept, now: 10_000 + REROUTE.COOLDOWN_MS }).reason).toBe("kept");
  });
});

describe("call budget", () => {
  it("caps a drive at 40 route calls per rolling hour", () => {
    let mem = emptyRerouteMemory(0);
    mem = recordRouteCalls(mem, 39, 1_000);
    expect(canSpendRouteCalls(mem, 1, 1_000)).toBe(true);
    expect(canSpendRouteCalls(mem, 2, 1_000)).toBe(false);
    mem = recordRouteCalls(mem, 1, 1_000);
    expect(canSpendRouteCalls(mem, 1, 1_000)).toBe(false);
    expect(canSpendRouteCalls(mem, 1, 1_000 + REROUTE.HOUR_MS)).toBe(true);
  });
});

describe("cadence and incidents", () => {
  it("waits for the first check, then the interval, and fires immediately on a new crash", () => {
    const mem = emptyRerouteMemory(0);
    expect(dueForCheck(mem, 5_000, false)).toBe(false);
    expect(dueForCheck(mem, REROUTE.FIRST_CHECK_MS, false)).toBe(true);
    const after = { ...mem, lastCheckAt: 30_000 };
    expect(dueForCheck(after, 30_000 + REROUTE.CHECK_MS - 1, false)).toBe(false);
    expect(dueForCheck(after, 30_000 + REROUTE.CHECK_MS, false)).toBe(true);
    expect(dueForCheck(after, 31_000, true)).toBe(true);
  });

  it("only treats a new crash/closure within 150 m of the remaining line as a trigger", () => {
    expect(blockingKinds("crash")).toBe(true);
    expect(blockingKinds("jam")).toBe(false);
    const crash = { id: "c1", kind: "crash", lat: 25.7700, lon: -80.1918, title: "Crash · I-95" };
    const far = { id: "c2", kind: "crash", lat: 25.9, lon: -80.3, title: "Crash" };
    const jam = { id: "j1", kind: "jam", lat: 25.7700, lon: -80.1918, title: "Jam" };
    const mem = emptyRerouteMemory(0);
    expect(nearRemaining(crash, miami, 150)).toBe(true);
    expect(nearRemaining(far, miami, 150)).toBe(false);
    expect(newBlockingIncidents(mem, [crash, far, jam], miami).map((x) => x.id)).toEqual(["c1"]);
    expect(newBlockingIncidents({ ...mem, seenIncidentIds: ["c1"] }, [crash], miami)).toEqual([]);
  });
});

describe("line helpers and copy", () => {
  it("fingerprints a line and slices the remaining vertices", () => {
    const fp = routeFingerprint(miami);
    expect(fp).toContain("-80.192,25.762");
    expect(routeFingerprint(miami)).toBe(fp);
    expect(routeFingerprint([])).toBe("");
    const rest = remainingCoords(miami, 0.6);
    expect(rest.length).toBeGreaterThan(1);
    expect(rest[rest.length - 1]).toEqual(miami[miami.length - 1]);
    expect(sampleSupporting(miami, 3)).toHaveLength(3);
  });

  it("builds the glanceable line from a real save and a crash title", () => {
    expect(incidentWhy({ id: "1", kind: "crash", lat: 0, lon: 0, title: "Crash · I-95 N" })).toBe("crash on I-95");
    expect(promptCopy(360, "crash on I-95").line).toBe("Faster route · saves 6 min · crash on I-95");
    expect(promptCopy(180, "").line).toBe("Faster route · saves 3 min");
  });
});

describe("garage reroute toggle", () => {
  it("defaults on and keeps a saved off", () => {
    expect(migrateGarage(null).suggestReroute).toBe(true);
    expect(migrateGarage({ suggestReroute: false }).suggestReroute).toBe(false);
    expect(migrateGarage({ suggestReroute: "no" }).suggestReroute).toBe(true);
  });
});

describe("TomTom route mapper", () => {
  it("reads a real travelTime and refuses an empty summary", () => {
    expect(fromTomTomRoute({ summary: { travelTimeInSeconds: 812, trafficDelayInSeconds: 190, lengthInMeters: 9400 } }))
      .toEqual({ travelSec: 812, delaySec: 190, lengthM: 9400 });
    expect(fromTomTomRoute({ summary: {} })).toBeNull();
    expect(fromTomTomRoute(null)).toBeNull();
  });
});

describe("considerReroute", () => {
  const alt: AltCandidate = {
    fingerprint: "alt-a",
    coords: [[-80.2, 25.76], [-80.18, 25.79]],
    typicalSec: 700,
    via: "via I-95",
  };

  it("does not call routing when the key is missing or the toggle is off", async () => {
    let called = 0;
    const find = async () => { called += 1; return [alt]; };
    const time = async () => { called += 1; return { travelSec: 700, delaySec: 0 }; };
    const base = {
      now: 30_000,
      remainingSec: 1200,
      currentLiveSec: 1200,
      currentFingerprint: "cur",
      remainingLine: miami,
      items: [] as [],
      memory: emptyRerouteMemory(0),
      findAlternatives: find,
      timeFor: time,
    };
    expect((await considerReroute({ ...base, flags: flags({ configured: false }) })).offer).toBeNull();
    expect((await considerReroute({ ...base, flags: flags({ showTraffic: false }) })).offer).toBeNull();
    expect(called).toBe(0);
  });

  it("offers a real faster line and records one route call", async () => {
    const result = await considerReroute({
      now: 30_000,
      flags: ON,
      remainingSec: 1200,
      currentLiveSec: 1200,
      currentFingerprint: "cur",
      remainingLine: miami,
      items: [{ id: "c1", kind: "crash", lat: 25.7700, lon: -80.1918, title: "Crash · I-95" }],
      memory: emptyRerouteMemory(0),
      findAlternatives: async () => [alt],
      timeFor: async () => ({ travelSec: 840, delaySec: 40 }),
    });
    expect(result.calls).toBe(1);
    expect(result.offer?.saveSec).toBe(360);
    expect(result.offer?.why).toMatch(/crash on I-95/);
    expect(result.memory.callTimes).toHaveLength(1);
  });

  it("stays quiet when the alt does not clear the threshold", async () => {
    const result = await considerReroute({
      now: 30_000,
      flags: ON,
      remainingSec: 1200,
      currentLiveSec: 1200,
      currentFingerprint: "cur",
      remainingLine: miami,
      items: [],
      memory: emptyRerouteMemory(0),
      findAlternatives: async () => [alt],
      timeFor: async () => ({ travelSec: 1100, delaySec: 0 }),
    });
    expect(result.offer).toBeNull();
    expect(result.calls).toBe(1);
  });
});
