/**
 * Optional hours / open chip / photo well on search `#place-card`.
 * Only paints fields Nard already sent — never invents hours or photos.
 */
import { formatCloseHint, formatHours, formatOpenHint } from "../look/hours";
import {
  bindPhotoWell,
  classifyPhoto,
  photoCaption,
  rankPhotos,
  shortPhotoCredit,
  type PhotoKind,
} from "../look/photo-well";

export type PlaceExtrasStore = {
  hours?: string;
};

export type PlaceExtrasPhoto = {
  url?: string;
  credit?: string;
  source?: "wikimedia" | "wikidata" | "osm";
};

export type PlaceExtrasInfo = {
  openNow?: boolean;
  photos?: PlaceExtrasPhoto[];
};

export type PlaceExtrasPhotoView = {
  url: string;
  credit: string;
  source?: PlaceExtrasPhoto["source"];
  kind: PhotoKind;
  caption: string;
};

export type PlaceExtras = {
  openLabel?: string;
  openKind?: "open" | "closed";
  hours?: string;
  photos: PlaceExtrasPhotoView[];
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function placeExtrasFrom(
  store: PlaceExtrasStore,
  info?: PlaceExtrasInfo,
  at: Date = new Date(),
): PlaceExtras {
  const hoursRaw = store.hours?.trim();
  const openNow = info?.openNow;
  const extras: PlaceExtras = { photos: [] };
  if (hoursRaw) extras.hours = formatHours(hoursRaw);
  if (openNow === true) {
    const close = formatCloseHint(hoursRaw, true, at);
    extras.openKind = "open";
    extras.openLabel = close ? `Open · ${close}` : "Open now";
  } else if (openNow === false) {
    extras.openKind = "closed";
    extras.openLabel = formatOpenHint(hoursRaw, false, at) ?? "Closed";
  }
  extras.photos = rankPhotos(
    (info?.photos ?? [])
      .filter((p): p is PlaceExtrasPhoto & { url: string } => Boolean(p.url))
      .map((p) => {
        const kind = classifyPhoto({ url: p.url, credit: p.credit, source: p.source });
        return {
          url: p.url,
          credit: p.credit?.trim() || "",
          source: p.source,
          kind,
          caption: photoCaption(kind),
        };
      }),
  );
  return extras;
}

export function placeExtrasEmpty(extras: PlaceExtras): boolean {
  return !extras.openLabel && !extras.hours && extras.photos.length === 0;
}

export function placeExtrasHtml(extras: PlaceExtras): string {
  const meta = [
    extras.openLabel && extras.openKind
      ? `<span class="look-chip look-chip-${extras.openKind}">${esc(extras.openLabel)}</span>`
      : "",
    extras.hours ? `<p class="place-hours">${esc(extras.hours)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");
  const photos = extras.photos.length
    ? `<div class="look-photos" role="list">${extras.photos
        .map((p, i) => {
          const credit = shortPhotoCredit(p.credit);
          return `<figure class="look-photo is-${p.kind}" role="listitem" title="${esc(p.credit)}"${p.source ? ` data-source="${esc(p.source)}"` : ""}>
        <img src="${esc(p.url)}" alt="${esc(p.caption)}" referrerpolicy="no-referrer" decoding="async" loading="${i === 0 ? "eager" : "lazy"}" />
        <figcaption><span class="look-photo-kind">${esc(p.caption)}</span>${credit ? `<span class="look-photo-credit">${esc(credit)}</span>` : ""}</figcaption>
      </figure>`;
        })
        .join("")}</div>`
    : "";
  return `${meta ? `<div class="place-extras-meta">${meta}</div>` : ""}${photos}`;
}

export function paintPlaceExtras(root: HTMLElement, extras: PlaceExtras): void {
  if (placeExtrasEmpty(extras)) {
    root.hidden = true;
    root.replaceChildren();
    return;
  }
  root.hidden = false;
  root.innerHTML = placeExtrasHtml(extras);
  bindPhotoWell(root);
}
