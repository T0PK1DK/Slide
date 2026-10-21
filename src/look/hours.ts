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
