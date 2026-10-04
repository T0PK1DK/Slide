/**
 * Shareable trip card — numbers + ride name only.
 * No addresses, coordinates, map tiles, or times of day.
 * Renders 1080×1350 PNG on an offscreen canvas. Theme tokens come from
 * CSS custom properties when present; otherwise neutral fallbacks.
 */
import type { BadgeTier } from "./badges";
import type { ShareCardModel } from "./progress";

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

/** Fields allowed on the card. Anything else is a privacy bug. */
export const SHARE_CARD_KEYS = ["score", "xp", "miles", "level", "badge", "ride", "livery"] as const;

export type ShareCardView = {
  score: number | null;
  xp: number;
  miles: number;
  level: number;
  badge: { name: string; tier: BadgeTier } | null;
  ride: string;
  livery: string;
};

export type ShareTheme = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
};

/** Neutral night palette. Overridden by --bg / --surface / --text / --muted / --glow / --line when set. */
export const SHARE_THEME_FALLBACK: ShareTheme = {
  bg: "#121316",
  surface: "#1c1d21",
  text: "#f4f3ef",
  muted: "#a9a8ae",
  accent: "#c4c0b6",
  line: "#2a2b30",
};

const CSS_VARS: Record<keyof ShareTheme, string[]> = {
  bg: ["--bg"],
  surface: ["--surface", "--glass"],
  text: ["--text"],
  muted: ["--muted"],
  accent: ["--glow"],
  line: ["--line"],
};

function cssVar(names: string[], fallback: string, root?: Element | null): string {
  if (typeof getComputedStyle === "undefined") return fallback;
  const el = root ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return fallback;
  try {
    const style = getComputedStyle(el);
    for (const name of names) {
      const v = style.getPropertyValue(name).trim();
      if (v) return v;
    }
  } catch {
    /* jsdom / detached */
  }
  return fallback;
}

export function readShareTheme(root?: Element | null): ShareTheme {
  return {
    bg: cssVar(CSS_VARS.bg, SHARE_THEME_FALLBACK.bg, root),
    surface: cssVar(CSS_VARS.surface, SHARE_THEME_FALLBACK.surface, root),
    text: cssVar(CSS_VARS.text, SHARE_THEME_FALLBACK.text, root),
    muted: cssVar(CSS_VARS.muted, SHARE_THEME_FALLBACK.muted, root),
    accent: cssVar(CSS_VARS.accent, SHARE_THEME_FALLBACK.accent, root),
    line: cssVar(CSS_VARS.line, SHARE_THEME_FALLBACK.line, root),
  };
}

export function buildShareCardView(card: ShareCardModel, ride: { name: string; livery: string }): ShareCardView {
  return {
    score: card.score,
    xp: card.xp,
    miles: card.miles,
    level: card.level,
    badge: card.badge ? { name: card.badge.name, tier: card.badge.tier } : null,
    ride: ride.name,
    livery: ride.livery,
  };
}

function milesLabel(mi: number): string {
  if (!Number.isFinite(mi) || mi <= 0) return "0 mi";
  return `${mi >= 10 ? Math.round(mi) : mi.toFixed(1)} mi`;
}

/** Every string that will be painted. Used by tests and the canvas. */
export function cardLines(view: ShareCardView): string[] {
  const score = view.score == null ? "—" : String(Math.round(view.score));
  const lines = ["SLIDE", "SMOOTH", score, `+${Math.max(0, Math.floor(view.xp))} XP`, milesLabel(view.miles), `LVL ${view.level}`];
  if (view.badge) lines.push(`${view.badge.name} · ${view.badge.tier}`);
  lines.push(`${view.ride} · ${view.livery}`);
  return lines;
}

export type Canvas2D = Pick<
  CanvasRenderingContext2D,
  | "fillRect"
  | "fillText"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "stroke"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "globalAlpha"
>;

export function drawShareCard(ctx: Canvas2D, view: ShareCardView, theme: ShareTheme = SHARE_THEME_FALLBACK) {
  const w = SHARE_CARD_WIDTH;
  const h = SHARE_CARD_HEIGHT;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = theme.surface;
  ctx.fillRect(64, 64, w - 128, h - 128);

  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 200);
  ctx.lineTo(w - 96, 200);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.muted;
  ctx.font = "500 28px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("SLIDE", 112, 160);

  ctx.fillStyle = theme.muted;
  ctx.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("SMOOTH", 112, 360);

  ctx.fillStyle = theme.text;
  ctx.font = "200 280px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(view.score == null ? "—" : String(Math.round(view.score)), 100, 640);

  ctx.fillStyle = theme.accent;
  ctx.fillRect(112, 680, 160, 6);

  ctx.fillStyle = theme.text;
  ctx.font = "500 40px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`+${Math.max(0, Math.floor(view.xp))} XP`, 112, 800);
  ctx.fillText(milesLabel(view.miles), 112, 870);
  ctx.fillText(`LVL ${view.level}`, 112, 940);

  if (view.badge) {
    ctx.fillStyle = theme.muted;
    ctx.font = "600 26px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`${view.badge.name} · ${view.badge.tier}`.toUpperCase(), 112, 1040);
  }

  ctx.fillStyle = theme.text;
  ctx.font = "500 36px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`${view.ride} · ${view.livery}`, 112, 1180);
}

export type ShareSurface = {
  width: number;
  height: number;
  getContext(): Canvas2D;
  toPng(): Promise<Blob>;
};

export function createShareSurface(): ShareSurface {
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
    return {
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      getContext() {
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Share card: 2d context missing");
        return ctx as unknown as Canvas2D;
      },
      toPng: () => c.convertToBlob({ type: "image/png" }),
    };
  }
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = SHARE_CARD_WIDTH;
    c.height = SHARE_CARD_HEIGHT;
    return {
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      getContext() {
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Share card: 2d context missing");
        return ctx;
      },
      toPng: () =>
        new Promise((resolve, reject) => {
          c.toBlob((b) => (b ? resolve(b) : reject(new Error("Share card: PNG failed"))), "image/png");
        }),
    };
  }
  throw new Error("Share card needs a canvas");
}

export async function renderShareCardPng(
  view: ShareCardView,
  opts?: { theme?: ShareTheme; surface?: ShareSurface; root?: Element | null }
): Promise<Blob> {
  const surface = opts?.surface ?? createShareSurface();
  const theme = opts?.theme ?? readShareTheme(opts?.root);
  drawShareCard(surface.getContext(), view, theme);
  return surface.toPng();
}

export type ShareCardInput = {
  card: ShareCardModel;
  ride: { name: string; livery: string };
};

export type ShareTripResult = "shared" | "downloaded" | "cancelled";

export type ShareTripDeps = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  download?: (blob: Blob, filename: string) => void;
  png?: (view: ShareCardView) => Promise<Blob>;
};

function defaultDownload(blob: Blob, filename: string) {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function shareFilename(view: ShareCardView): string {
  const n = view.score == null ? "smooth" : String(Math.round(view.score));
  return `slide-${n}.png`;
}

export async function shareTrip(input: ShareCardInput, deps: ShareTripDeps = {}): Promise<ShareTripResult> {
  const view = buildShareCardView(input.card, input.ride);
  const blob = await (deps.png ?? renderShareCardPng)(view);
  const filename = shareFilename(view);
  const file = typeof File !== "undefined" ? new File([blob], filename, { type: "image/png" }) : null;
  const data: ShareData = file
    ? { files: [file], title: "Slide", text: "Smooth score on Slide" }
    : { title: "Slide", text: "Smooth score on Slide" };

  const canShare = deps.canShare ?? ((d: ShareData) => (typeof navigator !== "undefined" && navigator.canShare ? navigator.canShare(d) : false));
  const share = deps.share ?? ((d: ShareData) => (typeof navigator !== "undefined" && navigator.share ? navigator.share(d) : Promise.reject(new Error("no share"))));
  const download = deps.download ?? defaultDownload;

  if (file && canShare(data)) {
    try {
      await share(data);
      return "shared";
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return "cancelled";
    }
  }
  download(blob, filename);
  return "downloaded";
}

export type ShareCardMount = {
  update(input: ShareCardInput): void;
  share(): Promise<ShareTripResult>;
  unmount(): void;
};

/**
 * Paint a preview into an element Grim will mount (arrival share slot).
 * Inline styles only — does not touch src/styles.css or existing layout.
 */
export function mountShareCard(el: HTMLElement, input?: ShareCardInput, deps?: ShareTripDeps): ShareCardMount {
  let current = input ?? null;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (canvas) {
    canvas.width = SHARE_CARD_WIDTH;
    canvas.height = SHARE_CARD_HEIGHT;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Slide smooth score card");
    el.replaceChildren(canvas);
  }

  const paint = () => {
    if (!canvas || !current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const view = buildShareCardView(current.card, current.ride);
    drawShareCard(ctx, view, readShareTheme(el));
  };

  if (current) paint();

  return {
    update(next) {
      current = next;
      paint();
    },
    share() {
      if (!current) return Promise.resolve("cancelled");
      const png = canvas
        ? () =>
            new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Share card: PNG failed"))), "image/png");
            })
        : undefined;
      return shareTrip(current, { ...deps, png: deps?.png ?? png });
    },
    unmount() {
      el.replaceChildren();
      current = null;
    },
  };
}
