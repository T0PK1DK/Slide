/**
 * OSM opening_hours → a short card line. Falls back to the raw tag.
 * Look-only; does not touch Nard's feed.
 */

function ampm(hh: string, mm: string): string {
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return `${hh}:${mm}`;
  const suffix = h >= 12 ? "p" : "a";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

const SPAN = /(\d{2}):(\d{2})-(\d{2}):(\d{2})/;

function span(raw: string): string | null {
  const m = raw.match(SPAN);
  if (!m) return null;
  return `${ampm(m[1]!, m[2]!)}–${ampm(m[3]!, m[4]!)}`;
}

const DAYS: Record<string, string> = {
  Mo: "Mon",
  Tu: "Tue",
  We: "Wed",
  Th: "Thu",
  Fr: "Fri",
  Sa: "Sat",
  Su: "Sun",
};

function days(raw: string): string {
  const m = raw.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?/);
  if (!m) return raw.trim();
  if (m[1] === "Mo" && m[2] === "Su") return "Daily";
  const a = DAYS[m[1]!] ?? m[1]!;
  const b = m[2] ? DAYS[m[2]] ?? m[2] : "";
  return b ? `${a}–${b}` : a;
}

const OSM_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function coversDay(part: string, day: string): boolean {
  if (/\bMo-Su\b/.test(part)) return true;
  const range = part.match(/\b(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)\b/);
  if (range) {
    const a = OSM_DAYS.indexOf(range[1] as (typeof OSM_DAYS)[number]);
    const b = OSM_DAYS.indexOf(range[2] as (typeof OSM_DAYS)[number]);
    const d = OSM_DAYS.indexOf(day as (typeof OSM_DAYS)[number]);
    if (a < 0 || b < 0 || d < 0) return false;
    if (a <= b) return d >= a && d <= b;
    return d >= a || d <= b;
  }
  return new RegExp(`\\b${day}\\b`).test(part);
}

function startAmpm(part: string): string | null {
  const m = part.match(SPAN);
  if (!m) return null;
  const startH = Number(m[1]);
  const endH = Number(m[3]);
  const endM = Number(m[4]);
  if (startH === 0 && endH === 24 && endM === 0) return null;
  if (startH === 0 && endH === 0 && endM === 0) return null;
  return ampm(m[1]!, m[2]!);
}

function endAmpm(part: string): string | null {
  const m = part.match(SPAN);
  if (!m) return null;
  const startH = Number(m[1]);
  const endH = Number(m[3]);
  const endM = Number(m[4]);
  if (startH === 0 && endH === 24 && endM === 0) return null;
  if (startH === 0 && endH === 0 && endM === 0) return null;
  return ampm(m[3]!, m[4]!);
}

function todayPart(raw: string, at: Date): string | null {
  const s = raw.trim();
  if (!s || /24\/7/i.test(s)) return null;
  const day = OSM_DAYS[at.getDay()] ?? "Mo";
  const parts = s.split(";").map((p) => p.trim()).filter(Boolean);
  return parts.find((p) => coversDay(p, day)) ?? parts[0] ?? null;
}

/**
 * Chip extra when the place is open and today's OSM span has an end time.
 * `24/7` and all-day `00:00-24:00` stay just “Open now”.
 */
export function formatCloseHint(raw: string | undefined, openNow: boolean | undefined, at: Date = new Date()): string | null {
  if (openNow !== true) return null;
  const today = todayPart(raw?.trim() ?? "", at);
  if (!today) return null;
  const end = endAmpm(today);
  return end ? `closes ${end}` : null;
}

/**
 * Chip extra when the place is closed and today's OSM span has a start time.
 * `24/7` and all-day `00:00-24:00` stay just “Closed”. Keep “Hours unknown”.
 */
export function formatOpenHint(raw: string | undefined, openNow: boolean | undefined, at: Date = new Date()): string | null {
  if (openNow !== false) return null;
  const today = todayPart(raw?.trim() ?? "", at);
  if (!today) return null;
  const start = startAmpm(today);
  return start ? `Opens ${start}` : null;
}

/** One OSM rule (`Mo-Su 06:00-23:00` or `Mo-Sa 08:00-22:00; Su 08:00-21:00`). */
export function formatHours(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  const parts = s.split(";").map((p) => p.trim()).filter(Boolean);
  const out = parts.map((part) => {
    const time = span(part);
    if (!time) return part;
    return `${days(part)} ${time}`;
  });
  return out.join(" · ");
}
