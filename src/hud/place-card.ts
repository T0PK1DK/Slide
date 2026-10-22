import { PLACE_EMPTY } from "../look/empty";
import { formatCloseHint, formatHours, formatOpenHint } from "../look/hours";
import { mountHologram, prefersReducedMotion, type HologramDispose } from "../look/hologram";
import { CARD_ENTER_MS } from "../look/motion";
import { CATEGORY_LABEL, pinBadgeSvg, pinColor } from "../look/marks";
import {
  bindPhotoWell,
  classifyPhoto,
  photoCaption,
  rankPhotos,
  shortPhotoCredit,
  type PhotoKind,
} from "../look/photo-well";
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
  hoursLoading: boolean;
  address: string;
  addressEmpty: boolean;
  addressLoading: boolean;
  description: string;
  descriptionEmpty: boolean;
  photos: Array<{ url: string; credit: string; source?: string; kind: PhotoKind; caption: string }>;
  photosEmpty: boolean;
  photosEmptyLabel: string;
  photosLoading: boolean;
  descriptionLoading: boolean;
  stageLoading: boolean;
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

const ICO = {
  call: `<svg class="look-act-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3l1.2 3.2-1.8 1.2a12 12 0 0 0 6.2 6.2l1.2-1.8L20 14v3a2 2 0 0 1-2.2 2A15 15 0 0 1 5 6.2 2 2 0 0 1 7 4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  web: `<svg class="look-act-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 12h16M12 4c2.4 2.6 3.6 5.4 3.6 8S14.4 17.4 12 20c-2.4-2.6-3.6-5.4-3.6-8S9.6 6.6 12 4z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
  go: `<svg class="look-act-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  photo: `<svg class="look-empty-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13 16l2.4-3.2 4.6 5.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  clock: `<svg class="look-meta-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  pin: `<svg class="look-meta-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-6.2-6-10a6 6 0 1 1 12 0c0 3.8-6 10-6 10z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="11" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
} as const;

export function placeCardModel(store: Store, info?: PlaceInfo, opts?: { loading?: boolean; at?: Date }): PlaceCardModel {
  const name = storeName(store);
  const cat = store.category ? CATEGORY_LABEL[store.category] : PLACE_EMPTY.brand;
  const brand = store.brand?.trim() || store.brandKey?.trim();
  const brandLine = [brand, cat].filter(Boolean).join(" · ") || PLACE_EMPTY.brand;
  const openNow = info?.openNow;
  const hoursRaw = store.hours?.trim();
  const closeHint = opts?.at ? formatCloseHint(hoursRaw, openNow, opts.at) : formatCloseHint(hoursRaw, openNow);
  const openHint = opts?.at ? formatOpenHint(hoursRaw, openNow, opts.at) : formatOpenHint(hoursRaw, openNow);
  const address = store.address?.trim();
  const description = info?.description?.trim();
  const photos = (info?.photos ?? []).filter((p): p is PlacePhoto & { url: string } => Boolean(p.url));
  const website = store.website?.trim() || info?.website?.trim();
  const phone = store.phone?.trim();
  const color = pinColor(store);
  const loading = Boolean(opts?.loading);

  return {
    id: store.id ?? "",
    name: name ?? PLACE_EMPTY.name,
    nameEmpty: !name,
    brandLine,
    badgeSvg: pinBadgeSvg(store),
    openLabel:
      openNow === true
        ? closeHint
          ? `Open · ${closeHint}`
          : "Open now"
        : openNow === false
          ? openHint ?? "Closed"
          : PLACE_EMPTY.open,
    openKind: openNow === true ? "open" : openNow === false ? "closed" : "unknown",
    hours: hoursRaw ? formatHours(hoursRaw) : PLACE_EMPTY.hours,
    hoursEmpty: !hoursRaw,
    hoursLoading: loading && !hoursRaw,
    address: address ?? PLACE_EMPTY.address,
    addressEmpty: !address,
    addressLoading: loading && !address,
    description: description ?? PLACE_EMPTY.description,
    descriptionEmpty: !description,
    photos: rankPhotos(
      photos.map((p) => {
        const kind = classifyPhoto({ url: p.url, credit: p.credit, source: p.source });
        return {
          url: p.url,
          credit: p.credit?.trim() || PLACE_EMPTY.credit,
          source: p.source,
          kind,
          caption: photoCaption(kind),
        };
      }),
    ),
    photosEmpty: photos.length === 0,
    photosEmptyLabel: PLACE_EMPTY.photos,
    photosLoading: loading && photos.length === 0,
    descriptionLoading: loading && !description,
    stageLoading: loading,
    callHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null,
    webHref: website ?? null,
    callEmpty: !phone,
    webEmpty: !website,
    modelKey: modelKeyOf(store),
    color,
  };
}

function metaLine(kind: "hours" | "addr", text: string, empty: boolean, loading: boolean): string {
  const cls = `look-${kind}${loading ? " is-loading" : empty ? " is-empty" : ""}`;
  const ico = kind === "hours" ? ICO.clock : ICO.pin;
  return `<p class="${cls}">${ico}<span>${loading ? "" : esc(text)}</span></p>`;
}

export function placeCardHtml(model: PlaceCardModel): string {
  const photos = model.photosLoading
    ? `<div class="look-photos is-loading" data-empty="photos" aria-hidden="true"><i></i><i></i><i></i></div>`
    : model.photosEmpty
    ? `<div class="look-photos is-empty" data-empty="photos">${ICO.photo}<span>${esc(model.photosEmptyLabel)}</span></div>`
    : `<div class="look-photos" role="list">${model.photos
        .map((p, i) => {
          const credit = shortPhotoCredit(p.credit);
          return `<figure class="look-photo is-${p.kind}" role="listitem" title="${esc(p.credit)}"${p.source ? ` data-source="${esc(p.source)}"` : ""}>
        <img src="${esc(p.url)}" alt="${esc(p.caption)}" referrerpolicy="no-referrer" decoding="async" loading="${i === 0 ? "eager" : "lazy"}" />
        <figcaption><span class="look-photo-kind">${esc(p.caption)}</span>${credit ? `<span class="look-photo-credit">${esc(credit)}</span>` : ""}</figcaption>
      </figure>`;
        })
        .join("")}</div>`;

  return `<div class="look-sheet-handle" aria-hidden="true"></div>
<div class="look-holo-stage${model.stageLoading ? " is-loading" : ""}">
  <div class="look-holo-well">
    <i class="look-holo-ring" aria-hidden="true"></i>
    <div class="look-holo-slot" data-hologram></div>
  </div>
  <p class="look-holo-caption">${esc(PLACE_EMPTY.hologram)}</p>
</div>
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
  ${metaLine("hours", model.hours, model.hoursEmpty, model.hoursLoading)}
  ${metaLine("addr", model.address, model.addressEmpty, model.addressLoading)}
</div>
<div class="look-actions">
  <a class="look-act${model.callEmpty ? " is-empty" : ""}" data-act="call" ${model.callHref ? `href="${esc(model.callHref)}"` : 'aria-disabled="true" tabindex="-1"'}>${ICO.call}<span>Call</span><small>${model.callEmpty ? esc(PLACE_EMPTY.phone) : "Phone"}</small></a>
  <a class="look-act${model.webEmpty ? " is-empty" : ""}" data-act="web" ${model.webHref ? `href="${esc(model.webHref)}" target="_blank" rel="noopener"` : 'aria-disabled="true" tabindex="-1"'}>${ICO.web}<span>Website</span><small>${model.webEmpty ? esc(PLACE_EMPTY.website) : "Opens site"}</small></a>
  <button class="look-act look-act-primary" data-act="directions" type="button">${ICO.go}<span>Directions</span><small>From here</small></button>
</div>
${photos}
<p class="look-desc${model.descriptionLoading ? " is-loading" : model.descriptionEmpty ? " is-empty" : ""}">${model.descriptionLoading ? "" : esc(model.description)}</p>`;
}

export type PlaceCardHandle = {
  show(store: Store, info?: PlaceInfo, opts?: { loading?: boolean }): void;
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

function setSheetLift(root: HTMLElement, on: boolean): void {
  if (!on) {
    document.documentElement.style.removeProperty("--look-sheet-lift");
    return;
  }
  const apply = () => {
    const h = Math.round(root.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty("--look-sheet-lift", `${h + 16}px`);
  };
  apply();
  requestAnimationFrame(apply);
}

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
  let closeTimer = 0;

  const finishClose = () => {
    disposeHolo?.();
    disposeHolo = null;
    current = null;
    root.hidden = true;
    root.classList.remove("is-open", "is-preview-enter", "is-expanded");
    root.replaceChildren();
    setSheetLift(root, false);
    hooks.onClose?.();
  };

  const close = () => {
    clearTimeout(closeTimer);
    root.classList.remove("is-open", "is-preview-enter", "is-expanded");
    if (prefersReducedMotion() || root.hidden) {
      finishClose();
      return;
    }
    closeTimer = window.setTimeout(finishClose, CARD_ENTER_MS);
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
    show(store, info, opts) {
      clearTimeout(closeTimer);
      const fresh = root.hidden || !root.classList.contains("is-open");
      const model = placeCardModel(store, info, opts);
      current = store;
      disposeHolo?.();
      root.innerHTML = placeCardHtml(model);
      bindPhotoWell(root);
      root.hidden = false;
      root.classList.remove("is-preview-enter");
      root.setAttribute("aria-label", model.name);
      const slot = root.querySelector<HTMLElement>("[data-hologram]");
      const stage = root.querySelector<HTMLElement>(".look-holo-stage");
      if (slot) disposeHolo = mountHologram(slot, { modelKey: model.modelKey, color: model.color });
      if (stage) {
        stage.classList.remove("is-reveal");
        void stage.offsetWidth;
        stage.classList.add("is-reveal");
      }
      if (fresh && !prefersReducedMotion()) {
        root.classList.remove("is-open", "is-expanded");
        void root.offsetWidth;
        requestAnimationFrame(() => {
          root.classList.add("is-open", "is-expanded");
          setSheetLift(root, true);
        });
      } else {
        root.classList.add("is-open", "is-expanded");
        setSheetLift(root, true);
      }
    },
    hide: close,
    isOpen: () => !root.hidden,
    destroy() {
      clearTimeout(closeTimer);
      finishClose();
      root.remove();
    },
  };
}
