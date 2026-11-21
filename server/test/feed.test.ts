import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { FeedConfigInput, FetchFn } from "../src/rules/feedTypes.js";
import { fetchFeed } from "../src/rules/fetchFeed.js";
import { updateFeed, verifyFeed } from "../src/rules/verifyFeed.js";

const rules = [{ id: "r1", source: "user", when: [{ field: "from", operator: "endsWith", value: "@ads.example" }], then: { kind: "junk" }, status: "active" }];
const body = Buffer.from(JSON.stringify(rules));
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const rawPub = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64");
const sigFor = (b: Uint8Array) => sign(null, b, privateKey).toString("base64");

type Route = { status?: number; body?: string | Uint8Array; location?: string };
function fakeFetch(routes: Record<string, Route>): FetchFn & { calls: string[] } {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response("nope", { status: 404 });
    const headers = r.location ? { location: r.location } : undefined;
    return new Response(r.body ?? null, { status: r.status ?? 200, headers });
  };
  return Object.assign(fn, { calls });
}

const base: FeedConfigInput = { id: "f", url: "https://feeds.example/rules.json", allowedHosts: ["feeds.example"], sha256: sha(body) };
const previous = { rules: [], version: "old" };
const limits = { allowedHosts: ["feeds.example"], maxBytes: 1024 };

describe("fetchFeed", () => {
  it("rejects an http url", async () => {
    const f = fakeFetch({});
    expect(await fetchFeed("http://feeds.example/rules.json", { ...limits, fetch: f })).toMatchObject({ ok: false, reason: "only https is allowed" });
    expect(f.calls).toEqual([]);
  });
  it("rejects a host outside the allow-list", async () => {
    const f = fakeFetch({});
    expect(await fetchFeed("https://evil.example/rules.json", { ...limits, fetch: f })).toMatchObject({ ok: false });
    expect(f.calls).toEqual([]);
  });
  it("follows redirects only within the allow-list", async () => {
    const f = fakeFetch({
      "https://feeds.example/a": { status: 302, location: "/b" },
      "https://feeds.example/b": { status: 301, location: "https://evil.example/c" },
    });
    expect(await fetchFeed("https://feeds.example/a", { ...limits, fetch: f })).toMatchObject({ ok: false, reason: "host not allowed: evil.example" });
    expect(f.calls).toEqual(["https://feeds.example/a", "https://feeds.example/b"]);
  });
  it("stops after three redirect hops", async () => {
    const f = fakeFetch({ "https://feeds.example/loop": { status: 302, location: "/loop" } });
    expect(await fetchFeed("https://feeds.example/loop", { ...limits, fetch: f })).toMatchObject({ reason: "too many redirects" });
    expect(f.calls).toHaveLength(4);
  });
  it("rejects an oversize body while streaming", async () => {
    const f: FetchFn = async () => new Response(new ReadableStream({
      pull(c) { c.enqueue(new Uint8Array(600)); },
    }));
    expect(await fetchFeed("https://feeds.example/x", { ...limits, fetch: f })).toMatchObject({ ok: false, reason: "feed too large" });
  });
});

describe("verifyFeed", () => {
  it("rejects a bad hash", () => {
    expect(verifyFeed(body, { sha256: "0".repeat(64) })).toEqual({ ok: false, reason: "hash mismatch" });
  });
  it("rejects a bad signature", () => {
    const other = Buffer.from(sign(null, Buffer.from("x"), privateKey));
    expect(verifyFeed(body, { ed25519PublicKey: rawPub, signature: other })).toEqual({ ok: false, reason: "bad signature" });
  });
  it("rejects a schema failure, such as a delete action", () => {
    const bad = Buffer.from(JSON.stringify([{ ...rules[0], then: { kind: "delete" } }]));
    expect(verifyFeed(bad, { sha256: sha(bad) })).toEqual({ ok: false, reason: "schema validation failed" });
    const notJson = Buffer.from("{");
    expect(verifyFeed(notJson, { sha256: sha(notJson) })).toMatchObject({ ok: false });
  });
  it("accepts a pinned hash and forces source to feed", () => {
    const r = verifyFeed(body, { sha256: sha(body) });
    expect(r).toMatchObject({ ok: true, version: sha(body) });
    if (r.ok) expect(r.rules[0]).toMatchObject({ source: "feed", priority: 0 });
  });
});

describe("updateFeed", () => {
  it("installs a feed signed with ed25519", async () => {
    const f = fakeFetch({ "https://feeds.example/rules.json": { body }, "https://feeds.example/rules.sig": { body: sigFor(body) } });
    const cfg = { ...base, sha256: undefined, ed25519PublicKey: rawPub, signatureUrl: "https://feeds.example/rules.sig" };
    const r = await updateFeed(cfg, previous, { fetch: f });
    expect(r).toMatchObject({ updated: true, version: sha(body) });
    expect(r.rules).toHaveLength(1);
  });
  it.each([
    ["wrong host", { ...base, url: "https://evil.example/rules.json" }, {}],
    ["http url", { ...base, url: "http://feeds.example/rules.json" }, {}],
    ["bad hash", { ...base, sha256: "a".repeat(64) }, { "https://feeds.example/rules.json": { body } }],
    ["oversize", { ...base, maxBytes: 10 }, { "https://feeds.example/rules.json": { body } }],
    ["no proof", { ...base, sha256: undefined }, {}],
  ] as const)("keeps the previous version on %s", async (_, cfg, routes) => {
    const r = await updateFeed(cfg as FeedConfigInput, previous, { fetch: fakeFetch(routes as Record<string, Route>) });
    expect(r).toMatchObject({ rules: [], version: "old", updated: false });
    expect(r.reason).toBeTruthy();
  });
});
