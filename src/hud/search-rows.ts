/**
 * Search-sheet rows (Home / Work / recents). Same two-line language as suggest.
 * Look-only chrome — does not invent hours or touch Nard's geocode.
 */
import { SEARCH } from "../lib/empty";
import { splitPlaceLabel } from "../lib/place";

export type SavedRowKind = "home" | "work" | "recent" | "saved";

export type SavedRow = {
  name: string;
  address: string;
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function savedPlaceRow(label: string, kind: SavedRowKind, empty = false): SavedRow {
  if (empty && (kind === "home" || kind === "work")) {
    return { name: kind === "home" ? "Home" : "Work", address: "Save a place on this phone" };
  }
  const split = splitPlaceLabel(label);
  if (kind === "home" || kind === "work") {
    const name = kind === "home" ? "Home" : "Work";
    return { name, address: split.address === split.name ? split.name : split.address };
  }
  return {
    name: split.name,
    address: split.address === split.name ? "Saved on this phone" : split.address,
  };
}

export function savedRowInnerHtml(row: SavedRow): string {
  return `<span class="suggest-name">${esc(row.name)}</span><span class="suggest-addr">${esc(row.address)}</span>`;
}

export function recentsListHtml(items: Array<{ label: string; lon: number; lat: number }>): string {
  const rows = items.length
    ? items
        .map((r) => {
          const row = savedPlaceRow(r.label, "recent");
          return `<button type="button" class="recent-item" data-lon="${r.lon}" data-lat="${r.lat}" data-label="${esc(r.label)}">${savedRowInnerHtml(row)}</button>`;
        })
        .join("")
    : `<p class="suggest-status is-empty">${SEARCH.idle}</p>`;
  return `<div class="recents-label">Recent</div>${rows}`;
}
