import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestPost } from "../../functions/api/traffic/[[path]]";
import { TOMTOM_ROUTE } from "./sources/tomtom";

/** In-memory stand-in for the Workers edge cache (caches.default). */
function memoryCache(): Cache {
  const m = new Map<string, Response>();
  return {
    async match(req: RequestInfo | URL) {
      const r = m.get(typeof req === "string" ? req : req instanceof URL ? req.href : req.url);
      return r ? r.clone() : undefined;
    },
    async put(req: RequestInfo | URL, res: Response) {
      m.set(typeof req === "string" ? req : req instanceof URL ? req.href : req.url, res.clone());
    },
  } as unknown as Cache;
}

const env = { TOMTOM_API_KEY: "test-key" };
const waitUntil = (p: Promise<unknown>) => void p.catch(() => {});
const ctx = (request: Request) => ({ request, env, waitUntil, params: { path: ["route"] } });
const POINTS = "25.7617,-80.1918|25.7907,-80.1300";

const OK_ROUTE = {
  routes: [
    {
      summary: { lengthInMeters: 9000, travelTimeInSeconds: 1347, trafficDelayInSeconds: 60, noTrafficTravelTimeInSeconds: 1287 },
      legs: [{ points: [{ latitude: 25.7617, longitude: -80.1918 }, { latitude: 25.7907, longitude: -80.13 }] }],
      sections: [{ sectionType: "SPEED_LIMIT", startPointIndex: 0, endPointIndex: 1, maxSpeedLimitInKmh: 40 }],
    },
  ],
};

describe("TOMTOM_ROUTE URL", () => {
  it("never sends instructionsType (TomTom rejects 'none' with 400 BAD_INPUT)", () => {
    const u = new URL(TOMTOM_ROUTE({ lat: 25.76, lon: -80.19 }, { lat: 25.79, lon: -80.13 }, "k"));
    expect(u.searchParams.has("instructionsType")).toBe(false);
    expect(u.searchParams.get("traffic")).toBe("true");
    expect(u.searchParams.get("sectionType")).toBe("speedLimit");
    expect(u.searchParams.get("computeTravelTimeFor")).toBe("all");
  });
});

describe("/api/traffic/route handler", () => {
  beforeEach(() => {
    vi.stubGlobal("caches", { default: memoryCache() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET returns JSON 502 (not an uncaught throw) when TomTom answers 400", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"detailedError":{"code":"BAD_INPUT"}}', { status: 400 })));
    const res = await onRequestGet(ctx(new Request(`https://x.test/api/traffic/route?points=${encodeURIComponent(POINTS)}`)));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { configured: boolean; error: string };
    expect(body.configured).toBe(true);
    expect(body.error).toBe("HTTP 400");
  });

  it("POST returns JSON 502 when TomTom answers 400", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 400 })));
    const req = new Request("https://x.test/api/traffic/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points: [{ lat: 25.7617, lon: -80.1918 }, { lat: 25.7907, lon: -80.13 }] }),
    });
    const res = await onRequestPost(ctx(req));
    expect(res.status).toBe(502);
  });

  it("GET returns travelTimeSec, trafficDelaySec and speed limits on success", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(OK_ROUTE), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", f);
    const res = await onRequestGet(ctx(new Request(`https://x.test/api/traffic/route?points=${encodeURIComponent(POINTS)}`)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { travelTimeSec: number; trafficDelaySec: number; speedLimits: unknown[] };
    expect(body.travelTimeSec).toBe(1347);
    expect(body.trafficDelaySec).toBe(60);
    expect(body.speedLimits.length).toBeGreaterThan(0);
    const calledUrl = String((f.mock.calls[0] as unknown[])[0]);
    expect(calledUrl).not.toContain("instructionsType");
  });
});
