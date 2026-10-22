import { PLACE_EMPTY } from "./empty";

export type PhotoKind = "photo" | "logo";
export type LogoLayout = "mark" | "wordmark";

export type PhotoHint = {
  url: string;
  credit?: string;
  width?: number;
  height?: number;
  /** Nard's P154 official mark is `wikidata`; P18 stills are `wikimedia`. */
  source?: "wikimedia" | "wikidata" | "osm";
};

const LOGO_WORD = /logo|wordmark|logotype|emblem|seal|(?:^|[_\-/.])icon(?:[_\-/.]|$)/i;

function fileName(url: string): string {
  try {
    const raw = url.startsWith("data:") ? url : decodeURIComponent(url);
    const path = raw.split("?")[0] ?? raw;
    return path.slice(path.lastIndexOf("/") + 1);
  } catch {
    return url;
  }
}

function svgBox(url: string): { w: number; h: number } | null {
  if (!url.startsWith("data:image/svg")) return null;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url.replace(/^data:image\/svg\+xml[^,]*,/, ""));
  } catch {
    return null;
  }
  const box = decoded.match(/viewBox=["']0 0 ([\d.]+) ([\d.]+)["']/);
  if (box) return { w: Number(box[1]), h: Number(box[2]) };
  const w = decoded.match(/\bwidth=["'](\d+)["']/);
  const h = decoded.match(/\bheight=["'](\d+)["']/);
  if (w && h) return { w: Number(w[1]), h: Number(h[1]) };
  return null;
}

function nearSquare(w: number, h: number): boolean {
  if (!(w > 0) || !(h > 0)) return false;
  const r = w / h;
  return r >= 0.82 && r <= 1.22;
}

/** Wikimedia often sends a square mark. Landscape stills stay photos. */
export function classifyPhoto(photo: PhotoHint): PhotoKind {
  if (photo.source === "wikidata") return "logo";
  const name = `${fileName(photo.url)} ${photo.credit ?? ""}`;
  if (LOGO_WORD.test(name)) return "logo";
  if (photo.width && photo.height && nearSquare(photo.width, photo.height)) return "logo";
  const box = svgBox(photo.url);
  if (box && nearSquare(box.w, box.h)) return "logo";
  if (/\.svg(?:$|\?)/i.test(fileName(photo.url)) && !box) return "logo";
  return "photo";
}

export function photoCaption(kind: PhotoKind): string {
  return kind === "logo" ? PLACE_EMPTY.logoCaption : PLACE_EMPTY.photoCaption;
}

/** Drop the Commons filename. Keep a short source so the well does not wrap. */
export function shortPhotoCredit(credit?: string): string {
  const raw = credit?.trim() ?? "";
  if (!raw || raw === PLACE_EMPTY.credit) return "";
  if (/wikimedia/i.test(raw)) return "Wikimedia";
  const head = raw.split("·")[0]?.trim() || raw;
  return head.length > 28 ? `${head.slice(0, 27)}…` : head;
}

export function logoLayout(width: number, height: number): LogoLayout {
  if (!(width > 0) || !(height > 0)) return "mark";
  const r = width / height;
  return r > 1.35 || r < 0.55 ? "wordmark" : "mark";
}

export function rankPhotos<T extends { kind: PhotoKind }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => Number(b.kind === "logo") - Number(a.kind === "logo"));
}

export function markPhotoFallback(fig: HTMLElement): void {
  fig.classList.add("is-fallback");
  fig.classList.remove("is-logo", "is-photo", "is-mark", "is-wordmark");
  fig.querySelector("img")?.remove();
  const cap = fig.querySelector("figcaption");
  if (cap) cap.textContent = PLACE_EMPTY.photoFailed;
}

export function applyPhotoKind(fig: HTMLElement, kind: PhotoKind, credit?: string): void {
  fig.classList.toggle("is-logo", kind === "logo");
  fig.classList.toggle("is-photo", kind === "photo");
  fig.classList.remove("is-fallback");
  const cap = fig.querySelector("figcaption");
  if (!cap) return;
  let kindEl = cap.querySelector<HTMLElement>(".look-photo-kind");
  let creditEl = cap.querySelector<HTMLElement>(".look-photo-credit");
  if (!kindEl) {
    cap.replaceChildren();
    kindEl = document.createElement("span");
    kindEl.className = "look-photo-kind";
    creditEl = document.createElement("span");
    creditEl.className = "look-photo-credit";
    cap.append(kindEl, creditEl);
  }
  kindEl.textContent = photoCaption(kind);
  const short = shortPhotoCredit(credit ?? fig.getAttribute("title") ?? undefined);
  if (creditEl) {
    creditEl.textContent = short;
    creditEl.hidden = !short;
  }
}

export function applyPhotoLayout(fig: HTMLElement, kind: PhotoKind, width?: number, height?: number): void {
  const layout = kind === "logo" && width && height ? logoLayout(width, height) : null;
  fig.classList.toggle("is-mark", layout === "mark");
  fig.classList.toggle("is-wordmark", layout === "wordmark");
}

/** After paint: refine Logo vs Photo from real pixels, or swap in the empty well. */
export function bindPhotoWell(root: ParentNode): void {
  for (const fig of root.querySelectorAll<HTMLElement>("figure.look-photo")) {
    const img = fig.querySelector("img");
    if (!img) continue;
    img.addEventListener("error", () => markPhotoFallback(fig));
    const refine = () => {
      if (!img.naturalWidth) return;
      const source = fig.dataset.source as PhotoHint["source"] | undefined;
      const kind = classifyPhoto({
        url: img.currentSrc || img.src,
        credit: fig.getAttribute("title") ?? undefined,
        width: img.naturalWidth,
        height: img.naturalHeight,
        source,
      });
      applyPhotoKind(fig, kind, fig.getAttribute("title") ?? undefined);
      applyPhotoLayout(fig, kind, img.naturalWidth, img.naturalHeight);
    };
    if (img.complete) refine();
    else img.addEventListener("load", refine, { once: true });
  }
}
