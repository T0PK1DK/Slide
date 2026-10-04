/**
 * Per-trip smooth score from real on-device telemetry.
 *
 * Rewards gentle accel/brake, smooth heading changes, and staying at or under
 * the posted limit. Going faster never raises the score. Time over the limit
 * reduces or zeros that segment's contribution. A missing signal is skipped,
 * never invented.
 */
import { haversineMeters } from "../polyline";

const METERS_PER_MILE = 1609.344;
const MIN_DT_S = 0.3;
const MAX_DT_S = 8;
const STOPPED_MPH = 2;
const PACE_FULL = 3;
const PACE_ZERO = 10;
const TURN_FULL = 12;
const TURN_ZERO = 50;
const LIMIT_GRACE_MPH = 2;
const LIMIT_ZERO_OVER_MPH = 10;
const HARSH_BRAKE_MPH_S = 7;

export type TelemetrySample = {
  /** Unix ms. */
  at: number;
  /** GPS speed already converted to mph. */
  speedMph: number;
  /** Degrees clockwise from north. Null when the device has no heading. */
  headingDeg: number | null;
  /** Posted limit in mph when a real band is known; null otherwise. */
  postedMph: number | null;
  lon?: number;
  lat?: number;
};

export type SmoothFactors = {
  /** Gentle accel / brake, 0–1. Null when speed-over-time is missing. */
  pace: number | null;
  /** Smooth heading change, 0–1. Null when heading is missing. */
  turn: number | null;
  /** At-or-under the posted limit, 0–1. Null when no posted value. */
  limit: number | null;
};

export type SmoothScore = {
  /** 0–100, or null when no real factor could be scored. */
  total: number | null;
  factors: SmoothFactors;
  /** Miles that actually contributed to the score (distance of scored segments). */
  scoredMiles: number;
  /** Miles driven over the posted limit (only where posted was known). */
  overLimitMiles: number;
  /** Seconds spent over the posted limit (only where posted was known). */
  overLimitSec: number;
  /** True when a scored segment had |brake| above the harsh threshold. */
  harshBrake: boolean;
  /** How many consecutive sample pairs were scored. */
  segments: number;
};

export function headingDeltaDeg(a: number, b: number): number {
  return Math.abs(((b - a + 540) % 360) - 180);
}

export function paceFactor(accelMphPerSec: number): number {
  const mag = Math.abs(accelMphPerSec);
  if (mag <= PACE_FULL) return 1;
  if (mag >= PACE_ZERO) return 0;
  return 1 - (mag - PACE_FULL) / (PACE_ZERO - PACE_FULL);
}

export function turnFactor(degPerSec: number): number {
  const mag = Math.abs(degPerSec);
  if (mag <= TURN_FULL) return 1;
  if (mag >= TURN_ZERO) return 0;
  return 1 - (mag - TURN_FULL) / (TURN_ZERO - TURN_FULL);
}

/**
 * Full credit at or under the sign. Closer-to-the-limit is not worth more
 * than further under. Over the sign tapers to zero; never a bonus.
 */
export function limitFactor(speedMph: number, postedMph: number): number {
  if (speedMph <= postedMph) return 1;
  const over = speedMph - postedMph;
  if (over <= LIMIT_GRACE_MPH) return 0.6;
  if (over >= LIMIT_ZERO_OVER_MPH) return 0;
  return 0.6 * (1 - (over - LIMIT_GRACE_MPH) / (LIMIT_ZERO_OVER_MPH - LIMIT_GRACE_MPH));
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function segmentDistanceMi(a: TelemetrySample, b: TelemetrySample, dtS: number): number {
  if (
    a.lon != null && a.lat != null && b.lon != null && b.lat != null &&
    Number.isFinite(a.lon) && Number.isFinite(a.lat) &&
    Number.isFinite(b.lon) && Number.isFinite(b.lat)
  ) {
    return haversineMeters(a.lon, a.lat, b.lon, b.lat) / METERS_PER_MILE;
  }
  const mph = (a.speedMph + b.speedMph) / 2;
  if (!Number.isFinite(mph) || mph < 0) return 0;
  return mph * (dtS / 3600);
}

export function scoreTripSmooth(samples: readonly TelemetrySample[]): SmoothScore {
  const empty: SmoothScore = {
    total: null,
    factors: { pace: null, turn: null, limit: null },
    scoredMiles: 0,
    overLimitMiles: 0,
    overLimitSec: 0,
    harshBrake: false,
    segments: 0,
  };
  if (samples.length < 2) return empty;

  let paceW = 0, paceS = 0;
  let turnW = 0, turnS = 0;
  let limitW = 0, limitS = 0;
  let scoredW = 0, scoredS = 0;
  let overLimitMiles = 0;
  let overLimitSec = 0;
  let harshBrake = false;
  let segments = 0;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const dtS = (b.at - a.at) / 1000;
    if (!Number.isFinite(dtS) || dtS < MIN_DT_S || dtS > MAX_DT_S) continue;
    if (!Number.isFinite(a.speedMph) || !Number.isFinite(b.speedMph)) continue;
    if (a.speedMph < STOPPED_MPH && b.speedMph < STOPPED_MPH) continue;

    const miles = segmentDistanceMi(a, b, dtS);
    if (miles <= 0) continue;
    const weight = miles;

    const accel = (b.speedMph - a.speedMph) / dtS;
    const pace = paceFactor(accel);
    paceW += weight;
    paceS += pace * weight;
    if (accel <= -HARSH_BRAKE_MPH_S) harshBrake = true;

    let turn: number | null = null;
    if (a.headingDeg != null && b.headingDeg != null && Number.isFinite(a.headingDeg) && Number.isFinite(b.headingDeg)) {
      turn = turnFactor(headingDeltaDeg(a.headingDeg, b.headingDeg) / dtS);
      turnW += weight;
      turnS += turn * weight;
    }

    const posted = b.postedMph ?? a.postedMph;
    let limit: number | null = null;
    if (posted != null && posted > 0 && Number.isFinite(posted)) {
      const speed = Math.max(a.speedMph, b.speedMph);
      limit = limitFactor(speed, posted);
      limitW += weight;
      limitS += limit * weight;
      if (speed > posted + LIMIT_GRACE_MPH) {
        overLimitMiles += miles;
        overLimitSec += dtS;
      }
    }

    const present = [pace, turn, limit].filter((n): n is number => n != null);
    if (!present.length) continue;

    // Time over the limit zeros that segment's earnings.
    const raw = present.reduce((s, n) => s + n, 0) / present.length;
    const earnings = limit === 0 ? 0 : raw;
    scoredW += weight;
    scoredS += earnings * weight;
    segments += 1;
  }

  if (!scoredW) return { ...empty, harshBrake };

  return {
    total: Math.max(0, Math.min(100, Math.round((scoredS / scoredW) * 100))),
    factors: {
      pace: paceW ? paceS / paceW : null,
      turn: turnW ? turnS / turnW : null,
      limit: limitW ? limitS / limitW : null,
    },
    scoredMiles: scoredW,
    overLimitMiles,
    overLimitSec,
    harshBrake,
    segments,
  };
}

/** Miles that count as "driven smoothly" — distance scaled by the score. */
export function smoothMiles(distanceMi: number, score: number | null): number {
  if (score == null || score <= 0 || distanceMi <= 0) return 0;
  return distanceMi * (score / 100);
}
