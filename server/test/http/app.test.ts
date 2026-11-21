import { afterEach, describe, expect, it, vi } from "vitest";
import { as, RUN, testApp } from "./helpers";

describe("public app auth", () => {
  const app = testApp();

  it("serves /healthz without auth and without details", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it.each([
    ["no header", {}, 401],
    ["blank header", as("  "), 401],
    ["unknown email", as("intruder@example.com"), 403],
    ["suffix of an allowed email", as("xowner@example.com"), 403],
    ["allowed email", as("owner@example.com"), 200],
    ["allowed email in other case", as(" Owner@Example.COM "), 200],
  ])("%s → %i", async (_name, init, status) => {
    expect((await app.request("/api/runs", init)).status).toBe(status);
  });

  it("protects every /api path, known or not", async () => {
    expect((await app.request("/api/whatever")).status).toBe(401);
    expect((await app.request("/api")).status).toBe(401);
    expect((await app.request("/api/whatever", as("owner@example.com"))).status).toBe(404);
  });

  it("returns recent runs", async () => {
    const res = await app.request("/api/runs", as("owner@example.com"));
    expect(await res.json()).toEqual([RUN]);
  });

  it("does not expose the internal routes", async () => {
    const res = await app.request("/internal/runs", { method: "POST", ...as("owner@example.com") });
    expect(res.status).toBe(404);
  });

  it("sets security headers", async () => {
    const res = await app.request("/");
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'self'; frame-ancestors 'none'");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("same-origin");
  });
});

describe("errors", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a generic body and logs only the error name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = testApp(async () => {
      throw new TypeError("password=hunter2 at postgres://u:p@db");
    });
    const res = await app.request("/api/runs", as("owner@example.com"));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: "internal" });
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("TypeError");
    expect(`${body} ${logged}`).not.toMatch(/hunter2|postgres:|owner@example/);
  });
});
