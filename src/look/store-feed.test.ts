import { describe, expect, it, vi } from "vitest";
import type { PlaceInfo } from "../lib/place-info";
import type { Store } from "../lib/stores";
import {
  CLIENT_PLACE_TTL_MS,
  CLIENT_TILE_TTL_MS,
  LOOK_LIVE,
  MIN_STORE_ZOOM,
  createStoreFeed,
  lookStatusFor,
  nearestStore,
  shouldLoadStores,
  storesInBbox,
} from "./store-feed";

const walmart: Store = {
  id: "osm:node/123",
  name: "Walmart Supercenter",
  brand: "Walmart",
  brandKey: "walmart",
  category: "grocery",
  lat: 26.0112,
  lon: -80.1436,
  color: "#0071ce",
  modelKey: "walmart",
};

const shell: Store = {
  id: "osm:node/7",
  name: "Shell",
  brand: "Shell",
  brandKey: "shell",
  category: "fuel",
  lat: 26.12,
  lon: -80.14,
  color: "#fbce07",
  modelKey: "shell",
};

describe("store feed", () => {
  it("skips Overpass when the view is the whole metro", () => {
    expect(shouldLoadStores(MIN_STORE_ZOOM)).toBe(true);
    expect(shouldLoadStores(MIN_STORE_ZOOM - 0.01)).toBe(false);
  });

  it("filters stores to the current bbox", () => {
    const inView = storesInBbox([walmart, shell], { s: 26.0, w: -80.15, n: 26.02, e: -80.13 });
    expect(inView.map((s) => s.id)).toEqual(["osm:node/123"]);
  });

  it("picks the nearest store within 90 m", () => {
    expect(nearestStore([walmart, shell], 26.0112, -80.1436, 90)?.id).toBe("osm:node/123");
    expect(nearestStore([walmart], 26.12, -80.14, 90)).toBeUndefined();
  });

  it("status copy covers zoom, loading, error, empty, and pins-ready", () => {
    expect(lookStatusFor({ zoom: 11, loading: true, count: 0 }).kind).toBe("zoom");
    expect(lookStatusFor({ zoom: 13, loading: true, count: 0 }).text).toBe(LOOK_LIVE.loading);
    expect(lookStatusFor({ zoom: 13, loading: false, error: LOOK_LIVE.error, count: 0 }).kind).toBe("error");
    expect(lookStatusFor({ zoom: 13, loading: false, count: 0 }).kind).toBe("empty");
    expect(lookStatusFor({ zoom: 13, loading: false, count: 2 }).kind).toBeNull();
  });

  it("caches tiles per area and does not refetch a fresh tile", async () => {
    const fetchStores = vi.fn(async () => ({ items: [walmart] }));
    const feed = createStoreFeed({ fetchStores, now: () => 1_000 });
    const box = { s: 26.0, w: -80.2, n: 26.1, e: -80.1 };
    const first = await feed.loadBbox(box);
    expect(first.fromCache).toBe(false);
    expect(first.stores[0]?.id).toBe("osm:node/123");
    expect(fetchStores).toHaveBeenCalledTimes(1);
    const second = await feed.loadBbox(box);
    expect(second.fromCache).toBe(true);
    expect(fetchStores).toHaveBeenCalledTimes(1);
  });

  it("keeps stale pins and surfaces an error when Overpass is empty+failed", async () => {
    const fetchStores = vi.fn(async () => ({ items: [] as Store[], error: LOOK_LIVE.error }));
    const feed = createStoreFeed({ fetchStores, now: () => 1_000 });
    const snap = await feed.loadBbox({ s: 26.0, w: -80.2, n: 26.1, e: -80.1 });
    expect(snap.stores).toEqual([]);
    expect(snap.error).toBe(LOOK_LIVE.error);
    expect(snap.fromCache).toBe(false);
  });

  it("does not cache a failed tile so retry hits the network", async () => {
    let n = 0;
    const fetchStores = vi.fn(async () => {
      n += 1;
      if (n === 1) return { items: [] as Store[], error: LOOK_LIVE.error };
      return { items: [walmart] };
    });
    const feed = createStoreFeed({ fetchStores, now: () => 1_000 });
    const box = { s: 26.0, w: -80.2, n: 26.1, e: -80.1 };
    expect((await feed.loadBbox(box)).error).toBe(LOOK_LIVE.error);
    const retry = await feed.loadBbox(box);
    expect(retry.stores[0]?.id).toBe("osm:node/123");
    expect(fetchStores).toHaveBeenCalledTimes(2);
  });

  it("ignores aborted in-flight fetches", async () => {
    const fetchStores = vi.fn(async (_url: string, signal?: AbortSignal) => {
      if (signal?.aborted) return { items: [] as Store[], aborted: true };
      return { items: [] as Store[], aborted: true };
    });
    const feed = createStoreFeed({ fetchStores, now: () => 1_000 });
    const snap = await feed.loadBbox({ s: 26.0, w: -80.2, n: 26.1, e: -80.1 });
    expect(snap.fromCache).toBe(true);
    expect(snap.error).toBeUndefined();
  });

  it("caches place info for a half hour", async () => {
    let now = 5_000;
    const fetchPlace = vi.fn(async () => ({ storeId: walmart.id, photos: [] } satisfies PlaceInfo));
    const feed = createStoreFeed({ fetchPlace, now: () => now });
    await feed.loadPlace(walmart);
    await feed.loadPlace(walmart);
    expect(fetchPlace).toHaveBeenCalledTimes(1);
    now += CLIENT_PLACE_TTL_MS + 1;
    await feed.loadPlace(walmart);
    expect(fetchPlace).toHaveBeenCalledTimes(2);
  });

  it("tile TTL is minutes, not hours", () => {
    expect(CLIENT_TILE_TTL_MS).toBe(8 * 60_000);
    expect(CLIENT_PLACE_TTL_MS).toBe(30 * 60_000);
  });
});
