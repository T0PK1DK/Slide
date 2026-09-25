import type { TripRecord } from "./history";
import type { SlideRoute } from "./smooth";

/**
 * The desktop alert list (SEKAI's severity-dot feed), built only from data Slide
 * really has: the planned route's posted limits and tolls, the driver's own
 * recorded trips, and real weather. No incident or traffic feed is connected
 * yet, so the list says so instead of inventing one.
 */
export type AlertLevel = "red" | "orange" | "green" | "info";
export type Alert = { level: AlertLevel; title: string; detail: string };

export type AlertInput = {
  route?: SlideRoute;
  avoidTolls: boolean;
  trips: TripRecord[];
  /** Open-Meteo condition label at the map centre, if loaded. */
  weather?: string | null;
  /** True once a live incident/traffic provider is wired (HANDOFF → Traffic provider decision). */
  incidentFeed?: boolean;
};

/** A posted limit that falls this much (mph) is worth a heads-up — the 45 → 30 pattern. */
export const DROP_MPH = 10;

export function buildAlerts(input: AlertInput, now = Date.now()): Alert[] {
  const out: Alert[] = [];
  const r = input.route;
  if (r) {
    if (r.hasToll === true && input.avoidTolls) {
      out.push({ level: "orange", title: "Toll road on this route", detail: "Avoid tolls is on, but no toll-free line was found for this trip" });
    } else if (r.hasToll === true) {
      out.push({ level: "info", title: "This route has tolls", detail: "SunPass or toll-by-plate; no price source connected" });
    }
    let drops = 0;
    for (let i = 1; i < r.bands.length && drops < 3; i++) {
      const a = r.bands[i - 1].postedMph, b = r.bands[i].postedMph;
      if (a && b && a - b >= DROP_MPH) {
        drops++;
        out.push({
          level: "orange",
          title: `Speed limit drops ${a} → ${b} mph`,
          detail: `${r.bands[i].name} · mile ${r.bands[i].fromMi.toFixed(1)}`,
        });
      }
    }
  }
  if (input.weather && /rain|storm|drizzle|fog/i.test(input.weather)) {
    out.push({ level: "orange", title: `${input.weather} at the map center`, detail: "Open-Meteo, current conditions" });
  }
  const recentOff = input.trips.filter((t) => now - t.startedAt <= 7 * 864e5 && t.offRouteEvents > 0);
  if (recentOff.length) {
    const n = recentOff.reduce((a, t) => a + t.offRouteEvents, 0);
    out.push({ level: "orange", title: `${n} off-route moment${n === 1 ? "" : "s"} this week`, detail: `Latest: ${recentOff[0].destLabel || "a drive"}` });
  }
  if (!input.incidentFeed) {
    out.push({ level: "info", title: "No live incident feed connected", detail: "Crashes and closures appear here once a traffic provider is approved" });
  }
  const rank: Record<AlertLevel, number> = { red: 0, orange: 1, green: 2, info: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Pure: the "Navigation intelligence" suggestion — switch to another planned line, with real typical-time savings. */
export type Suggestion = { targetId: string; title: string; detail: string; savesMin: number };

export function suggestSwitch(routes: SlideRoute[], selectedId: string): Suggestion | null {
  const sel = routes.find((r) => r.id === selectedId);
  if (!sel || routes.length < 2) return null;
  const quicker = routes.filter((r) => r.id !== sel.id && sel.durationSec - r.durationSec >= 60).sort((a, b) => a.durationSec - b.durationSec)[0];
  if (quicker) {
    const saves = Math.round((sel.durationSec - quicker.durationSec) / 60);
    const extraLefts = quicker.lefts - sel.lefts;
    return {
      targetId: quicker.id,
      savesMin: saves,
      title: `Switch to ${quicker.tags[0] ?? quicker.label}`,
      detail: `Saves about ${saves} min (typical time)${extraLefts > 0 ? ` · ${extraLefts} more left${extraLefts === 1 ? "" : "s"}` : ""}`,
    };
  }
  const slide = routes.find((r) => r.tags.includes("Slide pick"));
  if (slide && slide.id !== sel.id) {
    const costs = Math.max(0, Math.round((slide.durationSec - sel.durationSec) / 60));
    const fewer = sel.lefts - slide.lefts;
    return {
      targetId: slide.id,
      savesMin: -costs,
      title: "Switch to the Slide pick",
      detail: `${costs ? `${costs} min slower` : "Same time"}${fewer > 0 ? ` · ${fewer} fewer left${fewer === 1 ? "" : "s"}` : ""} · score ${slide.slideScore} vs ${sel.slideScore}`,
    };
  }
  return null;
}
