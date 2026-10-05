/** Shared edge cache for Pages Functions. One upstream call per key, then every driver shares it. */
export type WaitUntil = (p: Promise<unknown>) => void;

const UA = "Slide/1 (+https://kings-slide.pages.dev)";

export async function cachedGet(
  name: string,
  url: string,
  waitUntil: WaitUntil,
  ttl: number,
  timeoutMs = 7000,
): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://slide-cache.invalid/${name}`);
  let res = await cache.match(key);
  if (res) return res;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const up = await fetch(url, { headers: { accept: "*/*", "user-agent": UA }, signal: ctrl.signal });
    if (!up.ok) throw new Error(`HTTP ${up.status}`);
    const buf = await up.arrayBuffer();
    res = new Response(buf, {
      headers: {
        "content-type": up.headers.get("content-type") || "application/octet-stream",
        "cache-control": `public, max-age=${ttl}`,
      },
    });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    throw new Error(e instanceof Error && e.name === "AbortError" ? "timeout" : e instanceof Error ? e.message : "fetch failed");
  } finally {
    clearTimeout(t);
  }
}

export async function cachedJson(name: string, url: string, waitUntil: WaitUntil, ttl = 60, timeoutMs = 7000): Promise<unknown> {
  const res = await cachedGet(name, url, waitUntil, ttl, timeoutMs);
  return res.json();
}

export function json(body: unknown, maxAge = 30): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });
}
