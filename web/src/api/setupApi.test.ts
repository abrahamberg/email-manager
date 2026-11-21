import { describe, expect, it } from "vitest";
import { targetFor, EMPTY_IMAP } from "../pages/setup/target";
import { mockApi } from "./api";
import { createHttpApi } from "./httpApi";
import { failureText } from "./setupApi";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const imap = { provider: "imap", host: "imap.example.com", port: 993, user: "me", password: "pw" } as const;

describe("setup api over http", () => {
  it("posts test and learn to the server", async () => {
    const { fn, calls } = fakeFetch(200, { ok: true });
    const api = createHttpApi(fn).setup;
    await api.test(imap);
    await api.learn({ provider: "gmail" });
    expect(calls.map((c) => [c.url, c.init.method])).toEqual([["/api/setup/test", "POST"], ["/api/setup/learn", "POST"]]);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(imap);
  });

  it("reads status with GET", async () => {
    const { fn, calls } = fakeFetch(200, { oauthEnabled: true, connected: { office365: false, gmail: true } });
    expect((await createHttpApi(fn).setup.status()).connected.gmail).toBe(true);
    expect(calls[0]?.init.method).toBe("GET");
  });

  it("turns 409 into not_configured and other errors into a throw", async () => {
    expect(await createHttpApi(fakeFetch(409, {}).fn).setup.test({ provider: "gmail" })).toEqual({ ok: false, error: "not_configured" });
    await expect(createHttpApi(fakeFetch(500, {}).fn).setup.learn({ provider: "gmail" })).rejects.toThrow("500");
  });

  it("explains every failure code", () => {
    for (const code of ["login_failed", "reconnect_needed", "unreachable", "not_configured"] as const) expect(failureText(code)).not.toBe("");
  });
});

describe("mock setup api", () => {
  it("answers test and learn so the panel works without a server", async () => {
    expect((await mockApi.setup.test({ provider: "office365" })).ok).toBe(true);
    const learned = await mockApi.setup.learn({ provider: "gmail" });
    expect(learned.ok && learned.summary.daysRead).toBe(30);
  });
});

describe("targetFor", () => {
  it("needs no form for OAuth choices", () => {
    expect(targetFor("gmail", EMPTY_IMAP)).toEqual({ provider: "gmail" });
  });
  it.each([
    [{ ...EMPTY_IMAP, user: "u", password: "p" }], [{ ...EMPTY_IMAP, host: "h", password: "p" }],
    [{ ...EMPTY_IMAP, host: "h", user: "u" }], [{ ...EMPTY_IMAP, host: "h", user: "u", password: "p", port: 0 }],
  ])("is undefined while the IMAP form is incomplete %#", (form) => {
    expect(targetFor("imap", form)).toBeUndefined();
  });
  it("trims host and user for IMAP", () => {
    expect(targetFor("imap", { host: " h.example.com ", port: 993, user: " u ", password: "p" })).toEqual({ provider: "imap", host: "h.example.com", port: 993, user: "u", password: "p" });
  });
});
