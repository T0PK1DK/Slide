import type { PlacePhoto } from "./types";

/** Original sample stills (SVG data URIs). Credit on the strip, never a hotlink. */
export const PHOTO_CREDIT = "Slide look kit · sample still";

function svgPhoto(title: string, a: string, b: string, c: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">
  <rect width="320" height="200" fill="${a}"/>
  <rect y="118" width="320" height="82" fill="${b}"/>
  <rect x="36" y="48" width="248" height="86" rx="10" fill="${c}"/>
  <rect x="52" y="64" width="72" height="54" rx="6" fill="${a}" fill-opacity=".55"/>
  <rect x="136" y="64" width="72" height="54" rx="6" fill="${a}" fill-opacity=".4"/>
  <rect x="220" y="64" width="48" height="54" rx="6" fill="${a}" fill-opacity=".28"/>
  <circle cx="268" cy="36" r="18" fill="#f4e4b8" fill-opacity=".35"/>
  <text x="160" y="178" text-anchor="middle" font-size="13" font-family="system-ui,sans-serif" fill="#f7f3ea" fill-opacity=".78">${escapeXml(title)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function samplePhoto(kind: "aisle" | "facade" | "lot" | "pump", title: string): PlacePhoto {
  const palettes: Record<typeof kind, [string, string, string]> = {
    aisle: ["#1a2430", "#141c24", "#2a3a48"],
    facade: ["#2a2118", "#1c1610", "#4a3828"],
    lot: ["#14181c", "#0e1216", "#2c343c"],
    pump: ["#1c1810", "#12100c", "#3a3220"],
  };
  const [a, b, c] = palettes[kind];
  return {
    url: svgPhoto(title, a, b, c),
    credit: PHOTO_CREDIT,
    source: "osm",
  };
}
