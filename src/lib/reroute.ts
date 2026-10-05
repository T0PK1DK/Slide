import { haversineMeters } from "./polyline";

/**
 * In-drive traffic reroute prompts.
 *
 * Geometry still comes from the current routing engine (Valhalla today).
 * Live travel times come from `/api/traffic/route` (TomTom, key server-side).
 * Nard can swap `RerouteEngine.findAlternatives` when TomTom Routing lands —
 * this file does not call Valhalla itself.
 *
 * Nothing is invented: no prompt without a real live time on both lines.
 */

export const REROUTE = {
  /** Periodic re-check while driving. */
  CHECK_MS: 150_000,
  /** First look after Go, so GPS + along-route samples can land. */
  FIRST_CHECK_MS: 20_000,
  /** New crash/closure within this of the remaining line triggers an immediate check. */
  INCIDENT_NEAR_M: 150,
  MIN_SAVE_SEC: 180,
  MIN_SAVE_RATIO: 0.1,
  COOLDOWN_MS: 300_000,
  PROMPT_MS: 12_000,
  /** Hard cap on `/api/traffic/route` calls per rolling hour, per drive. */
  MAX_ROUTE_CALLS_PER_HOUR: 40,
  HOUR_MS: 3_600_000,
} as const;

export type LonLat = { lon: number; lat: number };

export type AltCandidate = {
  fingerprint: string;
  coords: Array<[number, number]>;
  /** Typical (no live) seconds from the geometry engine. Never used as the live ETA. */
  typicalSec: number;
  via: string;
};

export type LiveTravel = {
  travelSec: number;
  delaySec: number;
};

/**
 * Plug-in for Nard's routing swap. Default impl in main.ts uses Valhalla.
 * A TomTom Routing impl should return real alternatives only — same shape.
 */
export type RerouteEngine = {
  findAlternatives(q: {
    from: LonLat;
    dest: LonLat;
    stops: LonLat[];
  }): Promise<AltCandidate[]>;
};

export type TrafficClock = {
  /** Traffic-aware time for a pair, optionally reconstructed along `supporting`. */
  timeFor(q: { from: LonLat; dest: LonLat; supporting?: Array<[number, number]> }): Promise<LiveTravel | null>;
};

export type IncidentLike = {
  id: string;
  kind: string;
  lat: number;
  lon: number;
  title: string;
};

export type RerouteMemory = {
  startedAt: number;
  lastCheckAt: number;
  lastPromptAt: number;
  kept: string[];
  callTimes: number[];
  seenIncidentIds: string[];
};

export type RerouteFlags = {
  configured: boolean;
  showTraffic: boolean;
  suggestReroute: boolean;
};

export type RerouteOffer = {
  fingerprint: string;
  saveSec: number;
  why: string;
  currentLiveSec: number;
  altLiveSec: number;
  via: string;
};

export function emptyRerouteMemory(now = 0): RerouteMemory {
  return { startedAt: now, lastCheckAt: 0, lastPromptAt: 0, kept: [], callTimes: [], seenIncidentIds: [] };
}

/** Garage Live traffic off, sub-toggle off, or no TomTom key → feature stays silent. */
export function rerouteEnabled(flags: RerouteFlags): boolean {
  return flags.configured === true && flags.showTraffic === true && flags.suggestReroute === true;
}

/** Alternative must save at least max(3 min, 10% of remaining). */
export function saveThresholdSec(remainingSec: number): number {
  const remain = Number.isFinite(remainingSec) ? Math.max(0, remainingSec) : 0;
  return Math.max(REROUTE.MIN_SAVE_SEC, remain * REROUTE.MIN_SAVE_RATIO);
}

export function worthPrompt(currentLiveSec: number, altLiveSec: number, remainingSec: number): boolean {
  if (!Number.isFinite(currentLiveSec) || !Number.isFinite(altLiveSec)) return false;
  if (currentLiveSec <= 0 || altLiveSec <= 0) return false;
  return currentLiveSec - altLiveSec >= saveThresholdSec(remainingSec);
}

export function inCooldown(memory: RerouteMemory, now: number, ms = REROUTE.COOLDOWN_MS): boolean {
  return memory.lastPromptAt > 0 && now - memory.lastPromptAt < ms;
}

export function alreadyKept(memory: RerouteMemory, fingerprint: string): boolean {
  return Boolean(fingerprint) && memory.kept.includes(fingerprint);
}

export function recentRouteCalls(memory: RerouteMemory, now: number): number {
  return memory.callTimes.filter((t) => now - t < REROUTE.HOUR_MS).length;
}

export function canSpendRouteCalls(memory: RerouteMemory, n: number, now: number): boolean {
  if (n <= 0) return true;
  return recentRouteCalls(memory, now) + n <= REROUTE.MAX_ROUTE_CALLS_PER_HOUR;
}

export function recordRouteCalls(memory: RerouteMemory, n: number, now: number): RerouteMemory {
  if (n <= 0) return memory;
  const fresh = memory.callTimes.filter((t) => now - t < REROUTE.HOUR_MS);
  return { ...memory, callTimes: [...fresh, ...Array.from({ length: n }, () => now)] };
}

export function rememberKeep(memory: RerouteMemory, fingerprint: string, now: number): RerouteMemory {
  const kept = fingerprint && !memory.kept.includes(fingerprint) ? [...memory.kept, fingerprint] : memory.kept;
  return { ...memory, kept, lastPromptAt: now };
}

export function rememberDismiss(memory: RerouteMemory, now: number): RerouteMemory {
  return { ...memory, lastPromptAt: now };
}

export function routeFingerprint(coords: Array<[number, number]>): string {
  if (coords.length < 2) return "";
  const step = Math.max(1, Math.floor((coords.length - 1) / 7));
  const pts: string[] = [];
  for (let i = 0; i < coords.length; i += step) {
    pts.push(`${coords[i][0].toFixed(3)},${coords[i][1].toFixed(3)}`);
  }
  const last = coords[coords.length - 1];
  const tail = `${last[0].toFixed(3)},${last[1].toFixed(3)}`;
  if (pts[pts.length - 1] !== tail) pts.push(tail);
  return pts.join(";");
}

/** Remaining vertices of the line after `alongMi`. */
export function remainingCoords(coords: Array<[number, number]>, alongMi: number): Array<[number, number]> {
  if (coords.length < 2) return coords.slice();
  if (!Number.isFinite(alongMi) || alongMi <= 0) return coords.slice();
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const seg = haversineMeters(a[0], a[1], b[0], b[1]) / 1609.344;
    if (acc + seg >= alongMi) return coords.slice(i - 1);
    acc += seg;
  }
  return coords.slice(-2);
}

function distToSegment(lon: number, lat: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((lon - a[0]) * dx + (lat - a[1]) * dy) / len2));
  return haversineMeters(lon, lat, a[0] + t * dx, a[1] + t * dy);
}

export function nearRemaining(item: { lon: number; lat: number }, remaining: Array<[number, number]>, maxM = REROUTE.INCIDENT_NEAR_M): boolean {
  if (remaining.length < 1) return false;
  if (remaining.length === 1) return haversineMeters(remaining[0][0], remaining[0][1], item.lon, item.lat) <= maxM;
  for (let i = 1; i < remaining.length; i++) {
    if (distToSegment(item.lon, item.lat, remaining[i - 1], remaining[i]) <= maxM) return true;
  }
  return false;
}

export function blockingKinds(kind: string): boolean {
  return kind === "crash" || kind === "closure";
}

/** Crash/closure ids on the remaining line that we have not seen this drive. */
export function newBlockingIncidents(
  memory: RerouteMemory,
  items: IncidentLike[],
  remaining: Array<[number, number]>,
  maxM = REROUTE.INCIDENT_NEAR_M,
): IncidentLike[] {
  const seen = new Set(memory.seenIncidentIds);
  return items.filter((it) =>
    blockingKinds(it.kind) &&
    !seen.has(it.id) &&
    nearRemaining(it, remaining, maxM),
  );
}

export function markIncidentsSeen(memory: RerouteMemory, items: IncidentLike[]): RerouteMemory {
  const seen = new Set(memory.seenIncidentIds);
  for (const it of items) {
    if (blockingKinds(it.kind)) seen.add(it.id);
  }
  return { ...memory, seenIncidentIds: [...seen] };
}

export function dueForCheck(memory: RerouteMemory, now: number, incident: boolean): boolean {
  if (incident) return true;
  if (!memory.lastCheckAt) return now - memory.startedAt >= REROUTE.FIRST_CHECK_MS;
  return now - memory.lastCheckAt >= REROUTE.CHECK_MS;
}

export function incidentWhy(item: IncidentLike | null | undefined): string {
  if (!item) return "";
  const road = item.title.match(/\b(I-\d+[A-Z]?|US-?\d+|SR-?\d+|Hwy\s+\d+)\b/i)?.[0];
  const kind = item.kind === "closure" ? "closure" : item.kind === "crash" ? "crash" : item.kind;
  if (road) return `${kind} on ${road}`;
  return kind === "crash" ? "crash ahead" : `${kind} ahead`;
}

export function promptCopy(saveSec: number, why: string): { title: string; line: string; save: string; why: string } {
  const min = Math.max(1, Math.round(Math.max(0, saveSec) / 60));
  const save = `saves ${min} min`;
  const reason = why.trim();
  return {
    title: "Faster route",
    save,
    why: reason,
    line: reason ? `Faster route · ${save} · ${reason}` : `Faster route · ${save}`,
  };
}

export function decidePrompt(input: {
  flags: RerouteFlags;
  remainingSec: number;
  currentLiveSec: number | null;
  altLiveSec: number | null;
  altFingerprint: string;
  memory: RerouteMemory;
  now: number;
}): { prompt: boolean; saveSec: number; reason: "off" | "no-key" | "no-data" | "kept" | "cooldown" | "threshold" | "ok" } {
  if (!input.flags.configured) return { prompt: false, saveSec: 0, reason: "no-key" };
  if (!input.flags.showTraffic || !input.flags.suggestReroute) return { prompt: false, saveSec: 0, reason: "off" };
  if (input.currentLiveSec == null || input.altLiveSec == null) return { prompt: false, saveSec: 0, reason: "no-data" };
  if (alreadyKept(input.memory, input.altFingerprint)) return { prompt: false, saveSec: 0, reason: "kept" };
  if (inCooldown(input.memory, input.now)) return { prompt: false, saveSec: 0, reason: "cooldown" };
  const saveSec = input.currentLiveSec - input.altLiveSec;
  if (!worthPrompt(input.currentLiveSec, input.altLiveSec, input.remainingSec)) {
    return { prompt: false, saveSec, reason: "threshold" };
  }
  return { prompt: true, saveSec, reason: "ok" };
}

export type ConsiderInput = {
  now: number;
  flags: RerouteFlags;
  remainingSec: number;
  currentLiveSec: number | null;
  currentFingerprint: string;
  remainingLine: Array<[number, number]>;
  items: IncidentLike[];
  memory: RerouteMemory;
  findAlternatives: () => Promise<AltCandidate[]>;
  timeFor: (alt: AltCandidate) => Promise<LiveTravel | null>;
};

export type ConsiderResult = {
  memory: RerouteMemory;
  offer: RerouteOffer | null;
  calls: number;
};

/**
 * One drive tick. Spends at most one `/api/traffic/route` call (the alternative).
 * Current remaining time must already be a real live sample — we do not invent it.
 */
export async function considerReroute(input: ConsiderInput): Promise<ConsiderResult> {
  const freshHits = newBlockingIncidents(input.memory, input.items, input.remainingLine);
  const incident = freshHits.length > 0;
  let memory = input.memory;

  if (!rerouteEnabled(input.flags)) return { memory, offer: null, calls: 0 };
  if (inCooldown(memory, input.now)) return { memory, offer: null, calls: 0 };
  if (!dueForCheck(memory, input.now, incident)) return { memory, offer: null, calls: 0 };

  memory = { ...markIncidentsSeen(memory, input.items), lastCheckAt: input.now };
  if (input.currentLiveSec == null || input.currentLiveSec <= 0) return { memory, offer: null, calls: 0 };
  if (!canSpendRouteCalls(memory, 1, input.now)) return { memory, offer: null, calls: 0 };

  const alts = (await input.findAlternatives()).filter((a) => a.fingerprint && a.fingerprint !== input.currentFingerprint);
  const pick = alts.sort((a, b) => a.typicalSec - b.typicalSec)[0];
  if (!pick) return { memory, offer: null, calls: 0 };

  const live = await input.timeFor(pick);
  memory = recordRouteCalls(memory, 1, input.now);
  if (!live) return { memory, offer: null, calls: 1 };

  const decided = decidePrompt({
    flags: input.flags,
    remainingSec: input.remainingSec,
    currentLiveSec: input.currentLiveSec,
    altLiveSec: live.travelSec,
    altFingerprint: pick.fingerprint,
    memory,
    now: input.now,
  });
  if (!decided.prompt) return { memory, offer: null, calls: 1 };

  const why = incidentWhy(freshHits[0]) || pick.via.replace(/^via\s+/i, "");
  return {
    memory,
    calls: 1,
    offer: {
      fingerprint: pick.fingerprint,
      saveSec: decided.saveSec,
      why,
      currentLiveSec: input.currentLiveSec,
      altLiveSec: live.travelSec,
      via: pick.via,
    },
  };
}

/** Client fetch of `/api/traffic/route`. Null when unconfigured or the payload has no real time. */
export async function tomtomRouteTime(q: {
  from: LonLat;
  dest: LonLat;
  supporting?: Array<[number, number]>;
  alternatives?: number;
}): Promise<LiveTravel | null> {
  const params = new URLSearchParams({
    from: `${q.from.lat.toFixed(5)},${q.from.lon.toFixed(5)}`,
    to: `${q.dest.lat.toFixed(5)},${q.dest.lon.toFixed(5)}`,
  });
  if (q.supporting && q.supporting.length >= 2) {
    const pts = sampleSupporting(q.supporting, 40);
    params.set("points", pts.map((p) => `${p[1].toFixed(5)},${p[0].toFixed(5)}`).join("|"));
  } else if (q.alternatives && q.alternatives > 0) {
    params.set("alternatives", String(Math.min(2, q.alternatives)));
  }
  const ctrl = new AbortController();
  const t = typeof window !== "undefined" ? window.setTimeout(() => ctrl.abort(), 8000) : setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`/api/traffic/route?${params}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { configured?: boolean; routes?: Array<{ travelSec?: number; delaySec?: number }> };
    if (json.configured === false || !Array.isArray(json.routes)) return null;
    const first = json.routes[0];
    const travel = Number(first?.travelSec);
    if (!Number.isFinite(travel) || travel <= 0) return null;
    return { travelSec: Math.round(travel), delaySec: Math.max(0, Math.round(Number(first?.delaySec) || 0)) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Thin the line so the proxy stays inside its 40-point cap. */
export function sampleSupporting(coords: Array<[number, number]>, cap = 40): Array<[number, number]> {
  if (coords.length <= cap) return coords.slice();
  const out: Array<[number, number]> = [coords[0]];
  const step = (coords.length - 1) / (cap - 1);
  for (let i = 1; i < cap - 1; i++) out.push(coords[Math.round(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}
