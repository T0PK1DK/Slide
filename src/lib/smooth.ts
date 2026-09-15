import type { EdgeAttribute, Maneuver, ValhallaTrip } from "./valhalla";

export type SpeedBand = {
  fromMi: number;
  toMi: number;
  name: string;
  postedMph: number | null;
  expectedMph: number;
  seconds: number;
  roadClass: string;
};

export type SlideRoute = {
  id: string;
  trip: ValhallaTrip;
  shape: string;
  distanceMi: number;
  durationSec: number;
  slideScore: number;
  label: "Slide" | "Faster" | "Alt";
  why: string;
  turns: number;
  lefts: number;
  uturns: number;
  signals: number;
  stopDensity: number;
  speedVariance: number;
  postedCoverage: number;
  bands: SpeedBand[];
  maneuvers: Maneuver[];
  leaveBy?: Date;
};

const ROAD_CLASS_WEIGHT: Record<string, number> = {
  motorway: 1,
  trunk: 0.95,
  primary: 0.88,
  secondary: 0.78,
  tertiary: 0.62,
  unclassified: 0.48,
  residential: 0.32,
  service_other: 0.18,
  service: 0.18,
};

function kphToMph(kph: number): number {
  return kph * 0.621371;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function scoreTrip(
  trip: ValhallaTrip,
  edges: EdgeAttribute[],
  units: "miles" | "kilometers"
): Omit<SlideRoute, "id" | "label"> {
  const toMiles = units === "miles" ? 1 : 0.621371;
  const distanceMi = trip.summary.length * toMiles;
  const durationSec = trip.summary.time;
  const maneuvers = trip.legs.flatMap((l) => l.maneuvers);
  const turns = maneuvers.filter((m) => isTurn(m)).length;
  const lefts = maneuvers.filter((m) => LEFT_TURNS.has(m.type)).length;
  const uturns = maneuvers.filter((m) => UTURNS.has(m.type)).length;
  const turnLoad = maneuvers.reduce((a, m) => a + turnCost(m), 0);

  const signals = edges.filter((e) => e.traffic_signal).length;
  const lengths = edges.map((e) => e.length || 0);
  const totalEdgeLen = lengths.reduce((a, b) => a + b, 0) || 1;

  const posted = edges.filter((e) => e.speed_limit && e.speed_limit > 0);
  const postedCoverage =
    posted.reduce((a, e) => a + (e.length || 0), 0) / totalEdgeLen;

  const expectedSpeeds = edges.map((e) => e.speed || e.free_flow_speed || 0);
  const speedVariance = stddev(expectedSpeeds.filter((s) => s > 0));

  const classScore =
    edges.reduce((acc, e) => {
      const w = ROAD_CLASS_WEIGHT[e.road_class ?? ""] ?? 0.5;
      return acc + w * (e.length || 0);
    }, 0) / totalEdgeLen;

  const turnPenalty = clamp(turnLoad / Math.max(distanceMi, 0.5), 0, 8);
  const signalPenalty = clamp(signals / Math.max(distanceMi, 0.5), 0, 6);
  const variancePenalty = clamp(speedVariance / 18, 0, 1);
  const coverageBonus = postedCoverage * 8;

  const slideScore = clamp(
    Math.round(
      38 +
        classScore * 42 +
        coverageBonus -
        turnPenalty * 4.2 -
        signalPenalty * 3.1 -
        variancePenalty * 10
    ),
    1,
    99
  );

  const bands = buildBands(edges, units);
  const stopDensity = (turns + signals) / Math.max(distanceMi, 0.2);

  const why = explain({
    turns,
    lefts,
    uturns,
    signals,
    classScore,
    postedCoverage,
  });

  return {
    trip,
    shape: trip.legs.map((l) => l.shape).join(""),
    distanceMi,
    durationSec,
    slideScore,
    why,
    turns,
    lefts,
    uturns,
    signals,
    stopDensity,
    speedVariance,
    postedCoverage,
    bands,
    maneuvers,
  };
}

/**
 * Valhalla maneuver types.
 * 9 slight-right, 10 right, 11 sharp-right, 12 u-turn-right, 13 u-turn-left,
 * 14 sharp-left, 15 left, 16 slight-left, 17-21 ramps/exits, 22-25 forks/merge,
 * 26-27 roundabout.
 */
const RIGHT_TURNS = new Set([9, 10, 11]);
const LEFT_TURNS = new Set([14, 15, 16]);
const UTURNS = new Set([12, 13]);
const RAMPS = new Set([17, 18, 19, 20, 21]);
const FORKS = new Set([22, 23, 24, 25]);
const ROUNDABOUTS = new Set([26, 27]);

function isTurn(m: Maneuver): boolean {
  const t = m.type;
  return (
    RIGHT_TURNS.has(t) ||
    LEFT_TURNS.has(t) ||
    UTURNS.has(t) ||
    RAMPS.has(t) ||
    FORKS.has(t) ||
    ROUNDABOUTS.has(t) ||
    /turn|exit|ramp|fork|merge|uturn|bear/i.test(m.instruction || "")
  );
}

/**
 * Not every turn costs the same ride. An unprotected left crosses oncoming
 * traffic and usually waits on a gap; a right is a slow-and-go. Weighting them
 * equally is what makes a "fewest turns" router pick a line that drives badly.
 */
export function turnCost(m: Maneuver): number {
  const t = m.type;
  if (UTURNS.has(t)) return 2.4;
  if (LEFT_TURNS.has(t)) return 1.8;
  if (RIGHT_TURNS.has(t)) return 1;
  if (ROUNDABOUTS.has(t)) return 0.8;
  if (RAMPS.has(t) || FORKS.has(t)) return 0.5;
  return isTurn(m) ? 1 : 0;
}

export function isLeftTurn(m: Maneuver): boolean {
  return LEFT_TURNS.has(m.type);
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function buildBands(
  edges: EdgeAttribute[],
  units: "miles" | "kilometers"
): SpeedBand[] {
  const toMiles = units === "miles" ? 1 : 0.621371;
  const bands: SpeedBand[] = [];
  let cursor = 0;

  for (const edge of edges) {
    const lenMi = (edge.length || 0) * toMiles;
    const name = (edge.names && edge.names[0]) || titleCase(edge.road_class || "road");
    const posted = edge.speed_limit ? Math.round(kphToMph(edge.speed_limit)) : null;
    const expected = Math.round(kphToMph(edge.speed || edge.free_flow_speed || 0));
    const seconds =
      expected > 0 ? (lenMi / expected) * 3600 : (edge.length || 0) * 60;

    const last = bands[bands.length - 1];
    const same =
      last &&
      last.name === name &&
      last.postedMph === posted &&
      last.expectedMph === expected;

    if (same && last) {
      last.toMi = cursor + lenMi;
      last.seconds += seconds;
    } else {
      bands.push({
        fromMi: cursor,
        toMi: cursor + lenMi,
        name,
        postedMph: posted,
        expectedMph: expected,
        seconds,
        roadClass: edge.road_class || "unknown",
      });
    }
    cursor += lenMi;
  }

  return bands.filter((b) => b.toMi - b.fromMi > 0.02 || b.seconds > 8);
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function explain(input: {
  turns: number;
  lefts: number;
  uturns: number;
  signals: number;
  classScore: number;
  postedCoverage: number;
}): string {
  const bits: string[] = [];
  if (input.classScore > 0.75) bits.push("stays on higher-class roads");
  else if (input.classScore < 0.45) bits.push("more surface streets");
  if (input.turns <= 4) bits.push("few direction changes");
  else bits.push(`${input.turns} turn${input.turns === 1 ? "" : "s"}`);
  if (input.uturns > 0) bits.push(`${input.uturns} u-turn${input.uturns > 1 ? "s" : ""}`);
  else if (input.lefts === 0 && input.turns > 0) bits.push("no left turns");
  else if (input.lefts >= 3) bits.push(`${input.lefts} unprotected lefts`);
  if (input.signals <= 3) bits.push("low signal density");
  if (input.postedCoverage > 0.5) bits.push("strong posted-speed coverage");
  if (!bits.length) bits.push("balanced path");
  return bits.join(" · ");
}

export function rankRoutes(
  scored: Array<Omit<SlideRoute, "id" | "label">>
): SlideRoute[] {
  if (!scored.length) return [];
  const bySlide = [...scored].sort((a, b) => b.slideScore - a.slideScore);
  const byTime = [...scored].sort((a, b) => a.durationSec - b.durationSec);

  const labeled = bySlide.map((r, i) => {
    const isFastest = r === byTime[0];
    let label: SlideRoute["label"] = i === 0 ? "Slide" : isFastest ? "Faster" : "Alt";
    if (i === 0 && isFastest) label = "Slide";
    return {
      ...r,
      id: `r${i}`,
      label,
    };
  });

  const slide = labeled.find((r) => r.label === "Slide")!;
  const faster = labeled.find((r) => r.label === "Faster");
  const rest = labeled.filter((r) => r !== slide && r !== faster);
  return [slide, ...(faster ? [faster] : []), ...rest];
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  if (m <= 0) return "< 1 min";
  return `${m} min`;
}

/** Longest named streets on the trip — “via Collins Avenue”, not a turn list. */
export function viaLine(maneuvers: Maneuver[]): string {
  const named = new Map<string, number>();
  for (const m of maneuvers) {
    const name = (m.street_names ?? []).find((n) => n && !/^(ramp|to )\b/i.test(n.trim()));
    if (!name) continue;
    named.set(name, (named.get(name) ?? 0) + (m.length || 0));
  }
  const top = [...named.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([n]) => n);
  if (!top.length) return "via the scored line";
  return `via ${top.join(" · ")}`;
}

export function formatMiles(mi: number): string {
  if (mi < 0.15) return `${Math.round(mi * 5280)} ft`;
  return `${mi.toFixed(mi >= 10 ? 0 : 1)} mi`;
}

export function arrivalClock(durationSec: number, from = new Date()): string {
  const t = new Date(from.getTime() + durationSec * 1000);
  return t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function leaveByForTarget(
  durationSec: number,
  target: Date,
  bufferSec = 180
): Date {
  return new Date(target.getTime() - (durationSec + bufferSec) * 1000);
}
