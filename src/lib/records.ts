/**
 * A driver's personal best, kept on-device. This is the "rival" that always
 * exists even with zero other players: the score is a hit-or-miss against
 * your own history, not a stat nobody reacts to. No backend, no accounts —
 * matches the same client-side constraint ghosts live under until presence
 * is designed.
 */
export type SlideRecord = {
  bestScore: number | null;
  bestScoreAt: string | null;
  drives: number;
};

const KEY = "slide.record.v1";

const DEFAULT_RECORD: SlideRecord = {
  bestScore: null,
  bestScoreAt: null,
  drives: 0,
};

export function loadRecord(): SlideRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_RECORD };
    return { ...DEFAULT_RECORD, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_RECORD };
  }
}

function saveRecord(r: SlideRecord) {
  localStorage.setItem(KEY, JSON.stringify(r));
}

export type ScoreOutcome = {
  record: SlideRecord;
  /** True on your very first drive too — there's always a best to beat next time. */
  isNewBest: boolean;
  /** score - previous best. Null only on the first drive ever, when there is no previous best. */
  delta: number | null;
};

/** Call once per drive actually started (not on every route preview). */
export function registerScore(score: number): ScoreOutcome {
  const prev = loadRecord();
  const isNewBest = prev.bestScore === null || score > prev.bestScore;
  const record: SlideRecord = {
    bestScore: isNewBest ? score : prev.bestScore,
    bestScoreAt: isNewBest ? new Date().toISOString() : prev.bestScoreAt,
    drives: prev.drives + 1,
  };
  saveRecord(record);
  return { record, isNewBest, delta: prev.bestScore === null ? null : score - prev.bestScore };
}
