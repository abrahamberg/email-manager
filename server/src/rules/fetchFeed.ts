import type { FetchFn, FetchResult } from "./feedTypes.js";

const MAX_HOPS = 3;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export type FetchLimits = { allowedHosts: string[]; maxBytes: number; fetch?: FetchFn; timeoutMs?: number };

function checkUrl(raw: string, allowedHosts: string[]): URL | string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "invalid url";
  }
  if (url.protocol !== "https:") return "only https is allowed";
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.some((h) => h.toLowerCase() === host)) return `host not allowed: ${host}`;
  return url;
}

async function readCapped(res: Response, maxBytes: number): Promise<FetchResult> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, reason: "feed too large" };
  if (!res.body) return { ok: true, bytes: new Uint8Array() };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: "feed too large" };
    }
    chunks.push(value);
  }
  return { ok: true, bytes: Buffer.concat(chunks) };
}

export async function fetchFeed(start: string, limits: FetchLimits): Promise<FetchResult> {
  const doFetch = limits.fetch ?? fetch;
  const signal = AbortSignal.timeout(limits.timeoutMs ?? 10_000);
  let current = start;
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const url = checkUrl(current, limits.allowedHosts);
      if (typeof url === "string") return { ok: false, reason: url };
      const res = await doFetch(url.href, { redirect: "manual", signal });
      if (REDIRECTS.has(res.status)) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, reason: "redirect without location" };
        current = new URL(location, url).href;
        continue;
      }
      if (!res.ok) return { ok: false, reason: `http ${res.status}` };
      return await readCapped(res, limits.maxBytes);
    }
    return { ok: false, reason: "too many redirects" };
  } catch (err) {
    return { ok: false, reason: signal.aborted ? "timeout" : `fetch failed: ${(err as Error).name}` };
  }
}
