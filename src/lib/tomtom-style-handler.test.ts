import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../../functions/api/map/style";
import { onRequestGet as onTileGet } from "../../functions/api/map/tt/[[path]]";

const wait = { request: new Request("https://x.test/api/map/style?look=night"), env: {} };
const keyed = { ...wait, env: { TOMTOM_API_KEY: "secret-key" } };

describe("/api/map/style", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns 204 with no body when the key is missing", async () => {
    const res = await onRequestGet(wait);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("returns 204 when TomTom style fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const res = await onRequestGet(keyed);
    expect(res.status).toBe(204);
  });

  it("rewrites TomTom URLs and never returns the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      version: 8,
      sources: { v: { tiles: ["https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.pbf?key=secret-key"] } },
      layers: [],
    }), { status: 200 })));
    const res = await onRequestGet(keyed);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("secret-key");
    expect(body).toContain("/api/map/tt/map/1/tile/basic/main/{z}/{x}/{y}.pbf");
  });
});

describe("/api/map/tt proxy", () => {
  it("404s a path that is not a TomTom map asset", async () => {
    const res = await onTileGet({
      request: new Request("https://x.test/api/map/tt/evil/x"),
      env: { TOMTOM_API_KEY: "k" },
      params: { path: ["evil", "x"] },
    });
    expect(res.status).toBe(404);
  });

  it("returns 204 when the key is missing", async () => {
    const res = await onTileGet({
      request: new Request("https://x.test/api/map/tt/map/1/tile/basic/main/1/2/3.pbf"),
      env: {},
      params: { path: ["map", "1", "tile", "basic", "main", "1", "2", "3.pbf"] },
    });
    expect(res.status).toBe(204);
  });
});
