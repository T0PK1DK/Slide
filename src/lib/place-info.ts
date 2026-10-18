import { brandByKey, commonsFileUrl } from "./stores/brands";
import { openNow } from "./stores/hours";
import type { Store } from "./stores/types";

export type PlacePhoto = {
  url: string;
  credit: string;
  source: "wikimedia" | "wikidata" | "osm";
};

export type PlaceInfo = {
  storeId: string;
  description?: string;
  photos: PlacePhoto[];
  openNow?: boolean;
  website?: string;
};

export const PLACE_CACHE_TTL_SEC = 86_400;
export const WIKIDATA_UA = "Slide/1 (kings-slide.pages.dev)";

type WikidataSnak = {
  mainsnak?: { datavalue?: { value?: unknown } };
};

type WikidataEntity = {
  id?: string;
  descriptions?: { en?: { value?: string } };
  claims?: Record<string, WikidataSnak[] | undefined>;
};

function claimValues(entity: WikidataEntity, prop: string): string[] {
  const rows = entity.claims?.[prop] ?? [];
  const out: string[] = [];
  for (const row of rows) {
    const v = row.mainsnak?.datavalue?.value;
    if (typeof v === "string" && v.trim()) out.push(v.trim());
    else if (v && typeof v === "object" && "text" in v && typeof (v as { text: string }).text === "string") {
      out.push((v as { text: string }).text.trim());
    }
  }
  return out;
}

export function commonsUrl(file: string, width = 1280): string {
  return commonsFileUrl(file, width);
}

export function photoFromCommons(file: string, source: PlacePhoto["source"] = "wikimedia"): PlacePhoto {
  const name = file.replace(/^File:/i, "");
  return {
    url: commonsUrl(name),
    credit: `Wikimedia Commons · ${name}`,
    source,
  };
}

/**
 * Pure: Wikidata EntityData / wbgetentities → PlaceInfo.
 * P856 official website, P154 logo, P18 image. No invented copy.
 */
export function placeInfoFromWikidata(
  storeId: string,
  entity: unknown,
  extras: { hours?: string; website?: string; at?: Date } = {},
): PlaceInfo {
  const ent = (entity ?? {}) as WikidataEntity;
  const description = ent.descriptions?.en?.value?.trim();
  const website = extras.website ?? claimValues(ent, "P856")[0];
  const photos: PlacePhoto[] = [];
  const seen = new Set<string>();
  for (const file of [...claimValues(ent, "P154"), ...claimValues(ent, "P18")]) {
    const p = photoFromCommons(file, file === claimValues(ent, "P154")[0] ? "wikidata" : "wikimedia");
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    photos.push(p);
    if (photos.length >= 4) break;
  }
  const info: PlaceInfo = { storeId, photos };
  if (description) info.description = description;
  if (website) info.website = website;
  const now = openNow(extras.hours, extras.at);
  if (now !== undefined) info.openNow = now;
  return info;
}

export function parseWikidataEntityPayload(json: unknown, id: string): unknown {
  if (!json || typeof json !== "object") return null;
  const bag = json as { entities?: Record<string, unknown> };
  if (bag.entities?.[id]) return bag.entities[id];
  const first = bag.entities ? Object.values(bag.entities)[0] : undefined;
  return first ?? json;
}

export function wikidataEntityUrl(id: string): string {
  return `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`;
}

export type PlaceCache = {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
};

export async function loadPlaceInfo(
  input: {
    storeId: string;
    wikidata?: string;
    brandKey?: string;
    hours?: string;
    website?: string;
  },
  opts: {
    fetch?: typeof fetch;
    cache?: PlaceCache | null;
    waitUntil?: (p: Promise<unknown>) => void;
    at?: Date;
  } = {},
): Promise<PlaceInfo> {
  const wiki = input.wikidata ?? (input.brandKey ? brandByKey(input.brandKey)?.wikidata : undefined);
  const cacheKey = new Request(`https://slide-cache.invalid/place/${encodeURIComponent(input.storeId)}/${wiki ?? "osm"}`);
  if (opts.cache) {
    const hit = await opts.cache.match(cacheKey);
    if (hit) {
      try {
        const cached = (await hit.json()) as PlaceInfo;
        const now = openNow(input.hours, opts.at);
        return { ...cached, website: input.website ?? cached.website, ...(now !== undefined ? { openNow: now } : {}) };
      } catch {
        /* rebuild */
      }
    }
  }

  let info: PlaceInfo = { storeId: input.storeId, photos: [] };
  if (input.website) info.website = input.website;
  const now = openNow(input.hours, opts.at);
  if (now !== undefined) info.openNow = now;

  if (wiki) {
    const fetchFn = opts.fetch ?? fetch;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetchFn(wikidataEntityUrl(wiki), {
        headers: { "user-agent": WIKIDATA_UA, accept: "application/json" },
        signal: ctrl.signal,
      });
      if (res.ok) {
        const entity = parseWikidataEntityPayload(await res.json(), wiki);
        info = placeInfoFromWikidata(input.storeId, entity, {
          hours: input.hours,
          website: input.website,
          at: opts.at,
        });
      }
    } catch {
      /* keep OSM-only fields */
    } finally {
      clearTimeout(t);
    }
  }

  if (opts.cache) {
    const res = new Response(JSON.stringify(info), {
      headers: { "cache-control": `public, max-age=${PLACE_CACHE_TTL_SEC}` },
    });
    const put = opts.cache.put(cacheKey, res);
    if (opts.waitUntil) opts.waitUntil(put);
    else await put;
  }
  return info;
}

/** Grim: fill `#place-card` extras. Empty photos if the Function is down. */
export async function fetchPlaceInfo(store: Pick<Store, "id" | "brandKey" | "hours" | "website"> & { wikidata?: string }): Promise<PlaceInfo> {
  const q = new URLSearchParams({ storeId: store.id, brandKey: store.brandKey });
  if (store.hours) q.set("hours", store.hours);
  if (store.website) q.set("website", store.website);
  if (store.wikidata) q.set("wikidata", store.wikidata);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`/api/places?${q}`, { signal: ctrl.signal });
    if (!res.ok) return { storeId: store.id, photos: [] };
    return (await res.json()) as PlaceInfo;
  } catch {
    return { storeId: store.id, photos: [] };
  } finally {
    clearTimeout(t);
  }
}
