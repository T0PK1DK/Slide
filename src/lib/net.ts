/** Timed fetch with one retry. Used for Valhalla / Photon / style. */

export class NetError extends Error {
  readonly offline: boolean;
  constructor(message: string, offline = false) {
    super(message);
    this.name = "NetError";
    this.offline = offline;
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function friendly(err: unknown): NetError {
  if (err instanceof NetError) return err;
  if (isOffline()) return new NetError("You're offline. Check the connection and try again.", true);
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError") {
    return new NetError("That took too long. Check the connection and try again.");
  }
  return new NetError("Can't reach routing right now. Check your connection and try again.");
}

export async function fetchJson<T = any>(url: string, init: RequestInit = {}, ms = 8000): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const outer = init.signal;
    const onAbort = () => ctrl.abort();
    if (outer) {
      if (outer.aborted) throw friendly(new DOMException("Aborted", "AbortError"));
      outer.addEventListener("abort", onAbort, { once: true });
    }
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      last = err;
    } finally {
      clearTimeout(t);
      if (outer) outer.removeEventListener("abort", onAbort);
    }
  }
  throw friendly(last);
}

export function netMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof NetError) return err.message;
  if (err instanceof Error && /failed|network|fetch|load|abort/i.test(err.message)) {
    return friendly(err).message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
