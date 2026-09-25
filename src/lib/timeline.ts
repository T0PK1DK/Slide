import type { SpeedBand } from "./smooth";

export type SpeedDropMark = {
  /** 0–1 along the trip. */
  t: number;
  mph: number;
};

/** Posted-limit drops only. Never invent traffic. */
export function postedDropMarks(bands: SpeedBand[], totalMi: number): SpeedDropMark[] {
  const out: SpeedDropMark[] = [];
  if (totalMi <= 0) return out;
  let prev: number | null = null;
  for (const b of bands) {
    if (b.postedMph == null || b.postedMph <= 0) continue;
    if (prev != null && b.postedMph < prev) {
      out.push({
        t: Math.max(0, Math.min(1, b.fromMi / totalMi)),
        mph: b.postedMph,
      });
    }
    prev = b.postedMph;
  }
  return out.filter((m, i, a) => i === 0 || Math.abs(m.t - a[i - 1].t) > 0.04);
}

export function progressRatio(alongMi: number, totalMi: number): number {
  if (totalMi <= 0) return 0;
  return Math.max(0, Math.min(1, alongMi / totalMi));
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Signed seconds vs last-run ghost. Negative = behind. */
export function formatGhostVsLast(signedSec: number | null): { text: string; ahead: boolean } {
  if (signedSec == null || !Number.isFinite(signedSec)) {
    return { text: "no last run", ahead: false };
  }
  const ahead = signedSec >= 0;
  const abs = Math.abs(Math.round(signedSec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const body = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  return { text: `${ahead ? "+" : "−"}${body} vs your last run`, ahead };
}

export type TimelineView = {
  progress: number;
  drops: SpeedDropMark[];
  depart: string;
  arrive: string;
  ghost: { text: string; ahead: boolean };
};

export function buildTimeline(opts: {
  alongMi: number;
  totalMi: number;
  bands: SpeedBand[];
  departAt: Date;
  remainSec: number;
  ghostSignedSec: number | null;
}): TimelineView {
  return {
    progress: progressRatio(opts.alongMi, opts.totalMi),
    drops: postedDropMarks(opts.bands, opts.totalMi),
    depart: formatClock(opts.departAt),
    arrive: formatClock(new Date(Date.now() + Math.max(0, opts.remainSec) * 1000)),
    ghost: formatGhostVsLast(opts.ghostSignedSec),
  };
}
