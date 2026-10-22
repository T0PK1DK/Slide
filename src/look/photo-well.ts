import { PLACE_EMPTY } from "./empty";

export type PhotoKind = "photo" | "logo";

export type PhotoHint = {
  url: string;
  credit?: string;
  width?: number;
  height?: number;
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

export function markPhotoFallback(fig: HTMLElement): void {
  fig.classList.add("is-fallback");
  fig.classList.remove("is-logo", "is-photo");
  fig.querySelector("img")?.remove();
  const cap = fig.querySelector("figcaption");
  if (cap) cap.textContent = PLACE_EMPTY.photoFailed;
}

export function applyPhotoKind(fig: HTMLElement, kind: PhotoKind): void {
  fig.classList.toggle("is-logo", kind === "logo");
  fig.classList.toggle("is-photo", kind === "photo");
  fig.classList.remove("is-fallback");
  const cap = fig.querySelector("figcaption");
  if (cap) cap.textContent = photoCaption(kind);
}

/** After paint: refine Logo vs Photo from real pixels, or swap in the empty well. */
export function bindPhotoWell(root: ParentNode): void {
  for (const fig of root.querySelectorAll<HTMLElement>("figure.look-photo")) {
    const img = fig.querySelector("img");
    if (!img) continue;
    img.addEventListener("error", () => markPhotoFallback(fig));
    const refine = () => {
      if (!img.naturalWidth) return;
      applyPhotoKind(
        fig,
        classifyPhoto({
          url: img.currentSrc || img.src,
          credit: fig.getAttribute("title") ?? undefined,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }),
      );
    };
    if (img.complete) refine();
    else img.addEventListener("load", refine, { once: true });
  }
}
