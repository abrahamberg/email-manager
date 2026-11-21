import { describe, expect, it, vi } from "vitest";
import { backgroundRunner, createInternalApp } from "../../src/http/internalApp";
import type { RunDeps } from "../../src/pipeline/runMailbox";

const TOKEN = "t".repeat(40);
const post = (auth?: string): RequestInit => ({ method: "POST", headers: auth ? { Authorization: auth } : {} });

describe("internal app", () => {
  it.each([
    ["missing", undefined, 401],
    ["wrong", `Bearer ${"x".repeat(40)}`, 401],
    ["a prefix of the token", `Bearer ${TOKEN.slice(0, 10)}`, 401],
    ["not bearer", `Basic ${TOKEN}`, 401],
    ["right", `Bearer ${TOKEN}`, 202],
  ])("token %s → %i", async (_name, auth, status) => {
    const trigger = vi.fn(async () => true);
    const app = createInternalApp({ token: TOKEN, trigger });
    expect((await app.request("/internal/runs", post(auth))).status).toBe(status);
    expect(trigger).toHaveBeenCalledTimes(status === 202 ? 1 : 0);
  });

  it("answers 409 while a run is in progress", async () => {
    const app = createInternalApp({ token: TOKEN, trigger: async () => false });
    expect((await app.request("/internal/runs", post(`Bearer ${TOKEN}`))).status).toBe(409);
  });
});

describe("backgroundRunner", () => {
  const depsWith = (tryRun: RunDeps["lock"]["tryRun"], gate: Promise<void>): RunDeps =>
    ({
      lock: { tryRun },
      mailbox: { open: async () => { await gate; throw new Error("stop"); }, close: async () => {} },
      runs: { save: async () => {} },
      clock: { now: () => new Date() },
    }) as unknown as RunDeps;

  it("reports started, refuses a second trigger, then accepts again when idle", async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const runner = backgroundRunner(() => depsWith((work) => work(), gate));
    expect(await runner.trigger()).toBe(true);
    expect(await runner.trigger()).toBe(false);
    release();
    await runner.idle();
    expect(await runner.trigger()).toBe(true);
    await runner.idle();
  });

  it("reports busy when another process holds the lock", async () => {
    const runner = backgroundRunner(() => depsWith(async () => undefined, Promise.resolve()));
    expect(await runner.trigger()).toBe(false);
  });
});
