import type { Store, StoreCategory } from "./types";

/**
 * Bundled monograms + category glyphs. No hotlinked brand logos, no paid
 * image APIs. Credits live in docs/LOOK.md.
 */

export const CATEGORY_COLOR: Record<StoreCategory, string> = {
  grocery: "#3d8b37",
  pharmacy: "#cc0000",
  fuel: "#ffd100",
  fast_food: "#e51636",
  coffee: "#00704a",
  retail: "#0046be",
  other: "#8a8f98",
};

/** Public brand palette (same hex as Nard's brand table) for fixtures + pins. */
export const BRAND_COLOR: Record<string, string> = {
  walmart: "#0071ce",
  target: "#cc0000",
  costco: "#e31837",
  kroger: "#0066b2",
  publix: "#3d8b37",
  "whole-foods": "#00674b",
  aldi: "#00a0e1",
  "trader-joes": "#e31c23",
  safeway: "#e31837",
  albertsons: "#003da5",
  cvs: "#cc0000",
  walgreens: "#e31837",
  "rite-aid": "#003da5",
  shell: "#ffd100",
  exxon: "#ed1c24",
  chevron: "#ed1c24",
  bp: "#00a651",
  "circle-k": "#e31837",
  wawa: "#007a33",
  "7-eleven": "#00703c",
  mcdonalds: "#ffc72c",
  "burger-king": "#d62300",
  wendys: "#e41e26",
  "taco-bell": "#702082",
  "chick-fil-a": "#e51636",
  subway: "#008c15",
  chipotle: "#a81612",
  starbucks: "#00704a",
  dunkin: "#e11383",
  "home-depot": "#f96302",
  lowes: "#004990",
  "best-buy": "#0046be",
};

const CATEGORY_PATH: Record<StoreCategory, string> = {
  grocery: "M6 8h12l-1 10H7L6 8zm2 0V6.5A4 4 0 0 1 12 2.5 4 4 0 0 1 16 6.5V8",
  pharmacy: "M12 4v16M4 12h16",
  fuel: "M7 5h7v14H7zM14 8h3v8a2 2 0 0 0 2 2",
  fast_food: "M5 11h14a6 4 0 0 1-14 0zm2-3c1-3 9-3 10 0",
  coffee: "M7 9h9v6a4 4 0 0 1-9 0V9zm9 1h2.2A2.2 2.2 0 0 1 18 14h-2M9 5c.5 1 0 2 0 2m3-2c.5 1 0 2 0 2",
  retail: "M7 9h10l-1 11H8L7 9zm2 0V7a3 3 0 0 1 6 0v2",
  other: "M12 3l7 6v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z",
};

export function categoryIconPath(category: StoreCategory | undefined): string {
  return CATEGORY_PATH[category ?? "other"];
}

export function pinColor(store: Pick<Store, "color" | "brandKey" | "category">): string {
  if (store.color && /^#([0-9a-fA-F]{6})$/.test(store.color)) return store.color;
  const key = store.brandKey?.trim().toLowerCase();
  if (key && BRAND_COLOR[key]) return BRAND_COLOR[key];
  return CATEGORY_COLOR[store.category ?? "other"];
}

/** Light ink on yellow/pale brand discs, cream ink otherwise. */
export function contrastInk(color: string): string {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return "#f7f3ea";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 168 ? "#1a140c" : "#f7f3ea";
}

export function monogramLetter(store: Pick<Store, "brand" | "brandKey" | "name">): string {
  const fromBrand = (store.brand ?? store.brandKey ?? store.name ?? "?").trim();
  const ch = fromBrand.charAt(0);
  return (ch || "?").toUpperCase();
}

/**
 * Original two-letter mark for known chains (not a trademark). Lead is the
 * same character `monogramLetter` returns so existing pin ids stay stable.
 */
export const BRAND_MONOGRAM: Record<string, string> = {
  walmart: "Wa",
  target: "Ta",
  costco: "Co",
  kroger: "Kr",
  publix: "Pu",
  "whole-foods": "WF",
  aldi: "Al",
  "trader-joes": "TJ",
  safeway: "Sw",
  albertsons: "Ab",
  cvs: "CV",
  walgreens: "Wg",
  "rite-aid": "RA",
  shell: "Sh",
  exxon: "Ex",
  chevron: "Cv",
  bp: "BP",
  "circle-k": "CK",
  wawa: "Ww",
  "7-eleven": "7E",
  mcdonalds: "Mc",
  "burger-king": "BK",
  wendys: "We",
  "taco-bell": "TB",
  "chick-fil-a": "CF",
  subway: "Su",
  chipotle: "Cp",
  starbucks: "Sb",
  dunkin: "Du",
  "home-depot": "HD",
  lowes: "Lo",
  "best-buy": "BB",
};

export function monogramPair(store: Pick<Store, "brand" | "brandKey" | "name">): { lead: string; rest: string } {
  const key = store.brandKey?.trim().toLowerCase();
  const pair = key ? BRAND_MONOGRAM[key] : undefined;
  const lead = monogramLetter(store);
  if (pair && pair.charAt(0).toUpperCase() === lead) {
    return { lead, rest: pair.slice(1) };
  }
  if (pair) return { lead: pair.charAt(0), rest: pair.slice(1) };
  return { lead, rest: "" };
}

export function hasBundledMark(store: Pick<Store, "brandKey" | "logo" | "name" | "category">): boolean {
  const key = store.brandKey?.trim().toLowerCase();
  if (key && BRAND_COLOR[key]) return true;
  if (store.logo?.startsWith("data:") || store.logo?.startsWith("/")) return true;
  return false;
}

/**
 * Original 24×24 monogram disc. Used on the card. Map sprites use the
 * teardrop canvas in `store-pins`. Remote `logo` URLs are ignored.
 */
export function pinBadgeSvg(store: Pick<Store, "brand" | "brandKey" | "name" | "color" | "category" | "logo">): string {
  const color = pinColor(store);
  const ink = contrastInk(color);
  const { lead, rest } = monogramPair(store);
  const known = hasBundledMark(store);
  const glyph = known
    ? `<text x="12" y="16.2" text-anchor="middle" font-size="${rest ? 10 : 11}" font-weight="700" font-family="system-ui,sans-serif" fill="${ink}"><tspan>${lead}</tspan>${rest ? `<tspan font-size="8" dy="0">${escSvg(rest)}</tspan>` : ""}</text>`
    : `<path d="${categoryIconPath(store.category)}" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="${color}"/>
  <circle cx="12" cy="12" r="10.2" fill="none" stroke="${ink}" stroke-opacity=".28" stroke-width="1"/>
  <circle cx="8.2" cy="7.6" r="3.2" fill="${ink}" fill-opacity=".1"/>
  ${glyph}
</svg>`;
}

function escSvg(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export const CATEGORY_LABEL: Record<StoreCategory, string> = {
  grocery: "Grocery",
  pharmacy: "Pharmacy",
  fuel: "Fuel",
  fast_food: "Food",
  coffee: "Coffee",
  retail: "Retail",
  other: "Place",
};
