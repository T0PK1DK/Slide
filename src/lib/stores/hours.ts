/**
 * Tiny OSM opening_hours reader for common US-chain tags ("24/7",
 * "Mo-Su 08:00-22:00", "Mo-Fr 06:00-23:00; Sa-Su 07:00-22:00").
 * Unknown / empty → undefined so the UI never invents "open".
 */

const DAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function dayIndex(tok: string): number {
  return DAY.indexOf(tok as (typeof DAY)[number]);
}

function minutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function daysIn(token: string): number[] {
  const range = /^([A-Z][a-z])-([A-Z][a-z])$/.exec(token);
  if (range) {
    const a = dayIndex(range[1]);
    const b = dayIndex(range[2]);
    if (a < 0 || b < 0) return [];
    const out: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = (a + i) % 7;
      out.push(d);
      if (d === b) break;
    }
    return out;
  }
  const one = dayIndex(token);
  return one < 0 ? [] : [one];
}

function inWindow(nowMin: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (end < start) return nowMin >= start || nowMin < end;
  return nowMin >= start && nowMin < end;
}

/** Pure: is this store open at `at`? `at` is treated as the store's wall clock. */
export function openNow(hours: string | undefined, at: Date = new Date()): boolean | undefined {
  if (!hours) return undefined;
  const raw = hours.trim();
  if (!raw || raw === "unknown" || raw.startsWith("PH")) return undefined;
  if (raw === "24/7") return true;
  if (/^off$/i.test(raw)) return false;

  const day = at.getDay();
  const nowMin = at.getHours() * 60 + at.getMinutes();
  let matched = false;
  let open = false;
  let dayRules = false;

  for (const chunk of raw.split(";")) {
    const part = chunk.trim();
    if (!part) continue;
    if (/^off$/i.test(part)) {
      matched = true;
      open = false;
      continue;
    }
    const bits = part.split(/\s+/);
    const dayToks: string[] = [];
    const timeToks: string[] = [];
    for (const b of bits) {
      if (/^[A-Z][a-z](?:-[A-Z][a-z])?(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*$/.test(b)) {
        dayToks.push(...b.split(","));
      } else {
        timeToks.push(b);
      }
    }
    if (dayToks.length) dayRules = true;
    const days = dayToks.length ? dayToks.flatMap(daysIn) : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(day)) continue;
    matched = true;
    if (timeToks.some((t) => /^off$/i.test(t))) {
      open = false;
      continue;
    }
    if (timeToks.length === 0) {
      open = true;
      continue;
    }
    for (const t of timeToks) {
      const span = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(t);
      if (!span) continue;
      const start = minutes(span[1]);
      const end = minutes(span[2]);
      if (start === null || end === null) continue;
      if (inWindow(nowMin, start, end)) open = true;
    }
  }
  if (matched) return open;
  if (dayRules) return false;
  return undefined;
}
