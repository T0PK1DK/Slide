import { PLACE_EMPTY } from "../look/empty";
import { mountHologram, type HologramDispose } from "../look/hologram";
import { CATEGORY_LABEL, pinBadgeSvg, pinColor } from "../look/marks";
import {
  modelKeyOf,
  storeName,
  type PlaceInfo,
  type PlacePhoto,
  type Store,
} from "../look/types";

export type PlaceCardTrigger = "pin" | "stopped" | "destination";

export type PlaceCardModel = {
  id: string;
  name: string;
  nameEmpty: boolean;
  brandLine: string;
  badgeSvg: string;
  openLabel: string;
  openKind: "open" | "closed" | "unknown";
  hours: string;
  hoursEmpty: boolean;
  address: string;
  addressEmpty: boolean;
  description: string;
  descriptionEmpty: boolean;
  photos: Array<{ url: string; credit: string }>;
  photosEmpty: boolean;
  photosEmptyLabel: string;
  callHref: string | null;
  webHref: string | null;
  callEmpty: boolean;
  webEmpty: boolean;
  modelKey: string;
  color: string;
};

export function shouldOpenPlaceCard(opts: { trigger: PlaceCardTrigger; moving: boolean }): boolean {
  if (opts.trigger === "pin" || opts.trigger === "destination") return true;
  return !opts.moving;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function placeCardModel(store: Store, info?: PlaceInfo): PlaceCardModel {
  const name = storeName(store);
  const cat = store.category ? CATEGORY_LABEL[store.category] : PLACE_EMPTY.brand;
  const brand = store.brand?.trim() || store.brandKey?.trim();
  const brandLine = [brand, cat].filter(Boolean).join(" · ") || PLACE_EMPTY.brand;
  const openNow = info?.openNow;
  const hours = store.hours?.trim();
  const address = store.address?.trim();
  const description = info?.description?.trim();
  const photos = (info?.photos ?? []).filter((p): p is PlacePhoto & { url: string } => Boolean(p.url));
  const website = store.website?.trim() || info?.website?.trim();
  const phone = store.phone?.trim();
  const color = pinColor(store);

  return {
    id: store.id ?? "",
    name: name ?? PLACE_EMPTY.name,
    nameEmpty: !name,
    brandLine,
    badgeSvg: pinBadgeSvg(store),
    openLabel: openNow === true ? "Open now" : openNow === false ? "Closed" : PLACE_EMPTY.open,
    openKind: openNow === true ? "open" : openNow === false ? "closed" : "unknown",
    hours: hours ?? PLACE_EMPTY.hours,
    hoursEmpty: !hours,
    address: address ?? PLACE_EMPTY.address,
    addressEmpty: !address,
    description: description ?? PLACE_EMPTY.description,
    descriptionEmpty: !description,
    photos: photos.map((p) => ({ url: p.url, credit: p.credit?.trim() || PLACE_EMPTY.credit })),
    photosEmpty: photos.length === 0,
    photosEmptyLabel: PLACE_EMPTY.photos,
    callHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null,
    webHref: website ?? null,
    callEmpty: !phone,
    webEmpty: !website,
    modelKey: modelKeyOf(store),
    color,
  };
}

export function placeCardHtml(model: PlaceCardModel): string {
  const photos = model.photosEmpty
    ? `<div class="look-photos is-empty" data-empty="photos">${esc(model.photosEmptyLabel)}</div>`
    : `<div class="look-photos" role="list">${model.photos
        .map(
          (p) => `<figure class="look-photo" role="listitem">
        <img src="${esc(p.url)}" alt="" />
        <figcaption>${esc(p.credit)}</figcaption>
      </figure>`,
        )
        .join("")}</div>`;

  return `<div class="look-sheet-handle" aria-hidden="true"></div>
<div class="look-holo-slot" data-hologram></div>
<header class="look-sheet-head">
  <span class="look-badge">${model.badgeSvg}</span>
  <div class="look-titles">
    <h2 class="${model.nameEmpty ? "is-empty" : ""}">${esc(model.name)}</h2>
    <p class="look-brand">${esc(model.brandLine)}</p>
  </div>
  <button class="look-close" type="button" aria-label="Close place">×</button>
</header>
<div class="look-meta">
  <span class="look-chip look-chip-${model.openKind}${model.openKind === "unknown" ? " is-empty" : ""}">${esc(model.openLabel)}</span>
  <p class="look-hours${model.hoursEmpty ? " is-empty" : ""}">${esc(model.hours)}</p>
  <p class="look-addr${model.addressEmpty ? " is-empty" : ""}">${esc(model.address)}</p>
</div>
<div class="look-actions">
  <a class="look-act${model.callEmpty ? " is-empty" : ""}" data-act="call" ${model.callHref ? `href="${esc(model.callHref)}"` : 'aria-disabled="true" tabindex="-1"'}><span>Call</span><small>${model.callEmpty ? esc(PLACE_EMPTY.phone) : "Phone"}</small></a>
  <a class="look-act${model.webEmpty ? " is-empty" : ""}" data-act="web" ${model.webHref ? `href="${esc(model.webHref)}" target="_blank" rel="noopener"` : 'aria-disabled="true" tabindex="-1"'}><span>Website</span><small>${model.webEmpty ? esc(PLACE_EMPTY.website) : "Opens site"}</small></a>
  <button class="look-act look-act-primary" data-act="directions" type="button"><span>Directions</span><small>From here</small></button>
</div>
${photos}
<p class="look-desc${model.descriptionEmpty ? " is-empty" : ""}">${esc(model.description)}</p>`;
}

export type PlaceCardHandle = {
  show(store: Store, info?: PlaceInfo): void;
  hide(): void;
  isOpen(): boolean;
  el: HTMLElement;
  destroy(): void;
};

export type PlaceCardHooks = {
  host: HTMLElement;
  onClose?: () => void;
  onDirections?: (store: Store) => void;
};

export function mountPlaceCard(hooks: PlaceCardHooks): PlaceCardHandle {
  const root = document.createElement("section");
  root.className = "look-sheet panel";
  root.id = "look-place-card";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "false");
  hooks.host.appendChild(root);

  let current: Store | null = null;
  let disposeHolo: HologramDispose | null = null;

  const close = () => {
    disposeHolo?.();
    disposeHolo = null;
    current = null;
    root.hidden = true;
    root.replaceChildren();
    hooks.onClose?.();
  };

  root.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest(".look-close")) {
      ev.preventDefault();
      close();
      return;
    }
    const act = t.closest<HTMLElement>("[data-act]");
    if (act?.dataset.act === "directions" && current) {
      ev.preventDefault();
      hooks.onDirections?.(current);
    }
  });

  return {
    el: root,
    show(store, info) {
      const model = placeCardModel(store, info);
      current = store;
      disposeHolo?.();
      root.innerHTML = placeCardHtml(model);
      root.hidden = false;
      root.setAttribute("aria-label", model.name);
      const slot = root.querySelector<HTMLElement>("[data-hologram]");
      if (slot) disposeHolo = mountHologram(slot, { modelKey: model.modelKey, color: model.color });
    },
    hide: close,
    isOpen: () => !root.hidden,
    destroy() {
      close();
      root.remove();
    },
  };
}
