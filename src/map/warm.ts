/**
 * Start the map's own downloads while MapLibre (the biggest file) is still
 * coming down. index.html already preloads the style JSON and the TileJSON;
 * once the style arrives we preload the sprite sheet and the first glyph range
 * it names, so MapLibre finds them in the preload cache instead of starting a
 * second round trip after it boots. Vector tiles are left to MapLibre.
 */
type StyleLike = { sprite?: unknown; glyphs?: unknown; layers?: Array<{ layout?: Record<string, unknown> }> };

/** Pure: the sprite + glyph URLs MapLibre will ask for first, for this pixel ratio. */
export function warmUrls(style: StyleLike, pixelRatio: number): string[] {
  const out: string[] = [];
  if (typeof style.sprite === "string") {
    const base = style.sprite + (pixelRatio > 1 ? "@2x" : "");
    out.push(`${base}.json`, `${base}.png`);
  }
  if (typeof style.glyphs === "string") {
    const counts = new Map<string, number>();
    for (const l of style.layers ?? []) {
      const f = l.layout?.["text-font"];
      if (Array.isArray(f) && f.length === 1 && typeof f[0] === "string") counts.set(f[0], (counts.get(f[0]) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) out.push(style.glyphs.replace("{fontstack}", encodeURIComponent(top)).replace("{range}", "0-255"));
  }
  return out;
}

let warmed: object | null = null;
/** The style JSON boot already downloaded, so MapLibre can skip fetching it again (null until it lands). */
export function warmedStyle(): object | null { return warmed; }

function preload(href: string) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "fetch";
  link.crossOrigin = "anonymous";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Fetch the style now (index.html preloads it), then preload its sprite and
 * first glyph range once `ready` resolves. boot passes "MapLibre has finished
 * downloading", so the 160 kB of sprite + glyphs never competes with the map
 * engine for a slow connection, yet is already in flight when MapLibre asks.
 */
export function warmMapStyle(styleUrl: string, ready: Promise<unknown>) {
  fetch(styleUrl, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then(async (style: StyleLike | null) => {
      if (!style) return;
      warmed = style;
      await ready;
      for (const href of warmUrls(style, window.devicePixelRatio || 1)) preload(href);
    })
    .catch(() => { /* offline or blocked: MapLibre will report it itself */ });
}
