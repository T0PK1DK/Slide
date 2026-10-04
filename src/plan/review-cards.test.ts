import { describe, expect, it } from "vitest";
import { rankRoutes } from "../lib/smooth";
import { routeCards } from "./review-cards";

type Scored = Parameters<typeof rankRoutes>[0][number];
const route = (durationSec: number, slideScore: number, hasToll: boolean | null = null, why = "fewer lefts"): Scored =>
  ({ durationSec, slideScore, hasToll, why, distanceMi: durationSec / 200, maneuvers: [] } as unknown as Scored);

describe("routeCards", () => {
  it("builds one card per real ranked route and marks the selected one", () => {
    const ranked = rankRoutes([route(1000, 60, true), route(1080, 90, false)]);
    const cards = routeCards(ranked, ranked[0].id);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ tag: "Slide pick", selected: true });
    expect(cards[1].tag).toBe("Fastest");
    expect(cards.some((c) => c.tag === "No tolls" || c.why.includes("No tolls"))).toBe(true);
  });

  it("does not invent a second card when Valhalla only returned one line", () => {
    const [only] = rankRoutes([route(900, 80)]);
    const cards = routeCards([only], only.id);
    expect(cards).toHaveLength(1);
    expect(cards[0].tag).toBe("Slide pick");
    expect(cards[0].why).toContain("Fastest");
  });
});
