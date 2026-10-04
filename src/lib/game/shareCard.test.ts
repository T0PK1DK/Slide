import { describe, expect, it } from "vitest";
import type { ShareCardModel } from "./progress";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_KEYS,
  SHARE_CARD_WIDTH,
  SHARE_THEME_FALLBACK,
  buildShareCardView,
  cardLines,
  createShareSurface,
  drawShareCard,
  mountShareCard,
  readShareTheme,
  shareFilename,
  shareTrip,
  type Canvas2D,
  type ShareCardView,
  type ShareSurface,
} from "./shareCard";

const card: ShareCardModel = {
  score: 88,
  xp: 31,
  miles: 2.4,
  level: 2,
  badge: { name: "First Line", tier: "bronze" },
};

const view: ShareCardView = buildShareCardView(card, { name: "Slipstream", livery: "Stripes" });

const FORBIDDEN = [
  "address",
  "dest",
  "destlabel",
  "lat",
  "lon",
  "latitude",
  "longitude",
  "coord",
  "coords",
  "coordinates",
  "location",
  "place",
  "street",
  "startedat",
  "endedat",
  "time",
  "clock",
  "when",
  "map",
  "tile",
  "route",
];

function keysOf(v: unknown, path = ""): string[] {
  if (!v || typeof v !== "object") return path ? [path] : [];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, val]) => {
    const next = path ? `${path}.${k}` : k;
    return typeof val === "object" && val !== null ? [next, ...keysOf(val, next)] : [next];
  });
}

function fakeSurface(texts: string[] = []): ShareSurface {
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    fillRect() {},
    fillText(t: string) {
      texts.push(t);
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  } as unknown as Canvas2D;
  return {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    getContext: () => ctx,
    toPng: async () => new Blob(["png"], { type: "image/png" }),
  };
}

describe("share card model privacy", () => {
  it("only exposes score, xp, miles, level, badge, ride, livery", () => {
    expect(Object.keys(view).sort()).toEqual([...SHARE_CARD_KEYS].sort());
    const names = keysOf(view).map((k) => k.toLowerCase());
    for (const bad of FORBIDDEN) {
      expect(names.some((k) => k === bad || k.endsWith(`.${bad}`))).toBe(false);
    }
  });

  it("drops extra fields from the award instead of copying them through", () => {
    const dirty = { ...card, destLabel: "1200 Ocean Dr", lat: 25.77, lon: -80.13, startedAt: 1 } as ShareCardModel & {
      destLabel: string;
      lat: number;
      lon: number;
      startedAt: number;
    };
    const clean = buildShareCardView(dirty, { name: "Ridge", livery: "Fade" });
    expect(clean).not.toHaveProperty("destLabel");
    expect(clean).not.toHaveProperty("lat");
    expect(clean).not.toHaveProperty("lon");
    expect(clean).not.toHaveProperty("startedAt");
    expect(JSON.stringify(clean)).not.toMatch(/Ocean|25\.77|-80\.13/);
  });

  it("card copy has no address, clock, or coordinates", () => {
    const text = cardLines(view).join(" | ");
    expect(text).toContain("SLIDE");
    expect(text).toContain("88");
    expect(text).toContain("+31 XP");
    expect(text).toContain("2.4 mi");
    expect(text).toContain("LVL 2");
    expect(text).toContain("Slipstream · Stripes");
    expect(text).toContain("First Line · bronze");
    expect(text).not.toMatch(/Ave|Street|Drive|Rd|Blvd|lane|PM|AM|:\d{2}|lat|lon|-80\.|25\./i);
  });
});

describe("share card render", () => {
  it("is 1080×1350 and paints only the public lines", () => {
    const texts: string[] = [];
    drawShareCard(fakeSurface(texts).getContext(), view, SHARE_THEME_FALLBACK);
    expect(SHARE_CARD_WIDTH).toBe(1080);
    expect(SHARE_CARD_HEIGHT).toBe(1350);
    expect(texts.join(" ")).toContain("SMOOTH");
    expect(texts.join(" ")).not.toMatch(/Brickell|Ocean|Biscayne|map tile/i);
    expect(shareFilename(view)).toBe("slide-88.png");
    expect(shareFilename({ ...view, score: null })).toBe("slide-smooth.png");
  });

  it("falls back to neutral colors when CSS tokens are missing", () => {
    expect(readShareTheme(null)).toEqual(SHARE_THEME_FALLBACK);
  });

  it("shares via the Web Share API with a PNG file, else downloads", async () => {
    const downloads: string[] = [];
    const shared = await shareTrip(
      { card, ride: { name: "Pocket", livery: "Solid" } },
      {
        png: async () => new Blob(["png"], { type: "image/png" }),
        canShare: () => true,
        share: async () => {},
        download: (_b, name) => downloads.push(name),
      }
    );
    expect(shared).toBe("shared");
    expect(downloads).toEqual([]);

    const saved = await shareTrip(
      { card, ride: { name: "Pocket", livery: "Solid" } },
      {
        png: async () => new Blob(["png"], { type: "image/png" }),
        canShare: () => false,
        download: (_b, name) => downloads.push(name),
      }
    );
    expect(saved).toBe("downloaded");
    expect(downloads[0]).toBe("slide-88.png");
  });

  it("treats a share abort as cancelled and does not download", async () => {
    let downloaded = false;
    const result = await shareTrip(
      { card, ride: { name: "Hauler", livery: "Solid" } },
      {
        png: async () => new Blob(["png"], { type: "image/png" }),
        canShare: () => true,
        share: async () => {
          const err = new Error("nope");
          err.name = "AbortError";
          throw err;
        },
        download: () => {
          downloaded = true;
        },
      }
    );
    expect(result).toBe("cancelled");
    expect(downloaded).toBe(false);
  });

  it("mountShareCard paints into the given element only", () => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    const mount = mountShareCard(el, { card, ride: { name: "Classic", livery: "Fade" } });
    const canvas = el.querySelector("canvas");
    expect(canvas?.width).toBe(1080);
    expect(canvas?.height).toBe(1350);
    mount.unmount();
    expect(el.childNodes.length).toBe(0);
  });
});

describe("createShareSurface", () => {
  it("throws in this test runtime without a real canvas host", () => {
    const hasOffscreen = typeof OffscreenCanvas !== "undefined";
    const hasDoc = typeof document !== "undefined";
    if (hasOffscreen || hasDoc) {
      expect(() => createShareSurface()).not.toThrow();
    } else {
      expect(() => createShareSurface()).toThrow(/canvas/i);
    }
  });
});
