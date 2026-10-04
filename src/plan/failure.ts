/**
 * Why a plan or search failed, in words a driver can act on. Pure, so the
 * wording is tested; the sheet in main.ts only renders it with a Try again.
 */
export type FailKind = "offline" | "no-route" | "busy" | "unreachable";
export type Failure = { kind: FailKind; title: string; body: string };
export type FailWhat = "route" | "search";

/** A failed HTTP answer, with Valhalla's own error code/text when it sent one. */
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: number | null, detail: string) {
    super(detail ? `${status} ${detail}` : String(status));
    this.name = "HttpError";
  }
}

/** Valhalla codes meaning "these points can't be joined by road" (not a server problem). */
const NO_ROUTE_CODES = new Set([170, 171, 442, 443]);
const NO_ROUTE_TEXT = /no path could be found|no suitable edges|unconnected regions|no routes returned/i;

export function classifyFailure(err: unknown, online: boolean, what: FailWhat): Failure {
  const svc = what === "route" ? "routing" : "search";
  if (!online) {
    return {
      kind: "offline",
      title: "You're offline",
      body: `Slide needs a connection for ${what === "route" ? "routes" : "search"}. Your garage, places and trips are still on this phone.`,
    };
  }
  const msg = err instanceof Error ? err.message : "";
  if (what === "route" && ((err instanceof HttpError && err.code !== null && NO_ROUTE_CODES.has(err.code)) || NO_ROUTE_TEXT.test(msg))) {
    return {
      kind: "no-route",
      title: "No drivable route found",
      body: "These points can't be joined by road. Try a nearby address, or remove a stop.",
    };
  }
  if (err instanceof HttpError && err.status === 429) {
    return { kind: "busy", title: `The free ${svc} server is busy`, body: "It's limiting requests right now. Wait a few seconds, then try again." };
  }
  return { kind: "unreachable", title: `Can't reach ${svc}`, body: `The ${svc} server didn't answer. Check your signal, then try again.` };
}
