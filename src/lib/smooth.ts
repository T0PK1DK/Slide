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

  const turnPenalty = clamp(turns / Math.max(distanceMi, 0.5), 0, 8);
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
    signals,
    stopDensity,
    speedVariance,
    postedCoverage,
    bands,
    maneuvers,
  };
}

function isTurn(m: Maneuver): boolean {
  const t = m.type;
  return (
    (t >= 9 && t <= 14) ||
    (t >= 19 && t <= 27) ||
    /turn|exit|ramp|fork|merge|uturn|bear/i.test(m.instruction || "")
  );
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
  signals: number;
  classScore: number;
  postedCoverage: number;
}): string {
  const bits: string[] = [];
  if (input.classScore > 0.75) bits.push("stays on higher-class roads");
  else if (input.classScore < 0.45) bits.push("more surface streets");
  if (input.turns <= 4) bits.push("few direction changes");
  else bits.push(`${input.turns} turns`);
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
