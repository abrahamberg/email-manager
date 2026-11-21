import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { Context, MiddlewareHandler } from "hono";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

/** Serves files under `root`; any other GET gets index.html so client-side routes work. */
export function serveSpa(root: string): MiddlewareHandler {
  const base = resolve(root);
  return async (c) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") return c.json({ error: "not_found" }, 404);
    const rel = safeRelativePath(new URL(c.req.url).pathname);
    if (rel === undefined) return c.json({ error: "not_found" }, 404);
    const file = resolve(base, rel);
    if (file !== base && !file.startsWith(base + sep)) return c.json({ error: "not_found" }, 404);
    if (await isFile(file)) return sendFile(c, file, rel.startsWith("assets/"));
    const index = resolve(base, "index.html");
    if (await isFile(index)) return sendFile(c, index, false);
    return c.json({ error: "not_found" }, 404);
  };
}

/** Undefined for anything that could escape the root: dot-dot, NUL, backslashes, bad encoding. */
export function safeRelativePath(pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return undefined;
  const parts = decoded.split("/").filter(Boolean);
  if (parts.some((p) => p === ".." || p === ".")) return undefined;
  return parts.join("/");
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function sendFile(c: Context, file: string, immutable: boolean): Promise<Response> {
  const body = await readFile(file);
  c.header("Content-Type", TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
  c.header("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache");
  if (c.req.method === "HEAD") return c.body(null, 200);
  return c.body(new Uint8Array(body), 200);
}
