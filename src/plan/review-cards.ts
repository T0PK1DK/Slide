import { formatDuration, formatMiles, type SlideRoute } from "../lib/smooth";
import { tollLabel } from "./routeset";

/** One swipeable review card, built only from a real ranked route. */
export type RouteCard = {
  id: string;
  time: string;
  miles: string;
  tag: string;
  why: string;
  toll: string;
  selected: boolean;
};

/** Cards in rank order. Never invents a Slide / Fastest / No-tolls line. */
export function routeCards(routes: SlideRoute[], selectedId: string): RouteCard[] {
  return routes.map((r) => {
    const tag = r.tags[0] ?? r.label;
    const why = r.tags.length > 1
      ? `${r.tags.slice(1).join(" · ")} · ${r.why}`
      : r.why;
    const toll = r.tags.includes("No tolls") ? "" : tollLabel(r.hasToll);
    return {
      id: r.id,
      time: formatDuration(r.durationSec),
      miles: formatMiles(r.distanceMi),
      tag,
      why,
      toll,
      selected: r.id === selectedId,
    };
  });
}

export function cardAriaLabel(c: RouteCard): string {
  return [c.tag, c.time, c.miles, c.why, c.toll].filter(Boolean).join(", ");
}
