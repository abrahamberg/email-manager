import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config";
import { prepareLife } from "../../src/pipeline/lifeDeps";
import { aiFromConfig } from "../../src/wiring/aiFromConfig";
import { mailAuthFromConfig } from "../../src/wiring/mailAuthFromConfig";
import { imapEndpoint } from "../../src/wiring/mailboxFromConfig";
import { tokenStoreAdapter } from "../../src/wiring/tokenStoreAdapter";
import { lifeDeps } from "./lifeFakes";

const noTokens = { load: async () => undefined, save: async () => undefined };
const imap = { MAIL_PROVIDER: "imap", IMAP_HOST: "mail.example", IMAP_PORT: 993, IMAP_USER: "me@example", IMAP_PASSWORD: "pw" } as Config;

describe("wiring", () => {
  it("uses the configured host for generic IMAP and the provider host otherwise", () => {
    expect(imapEndpoint(imap)).toEqual({ host: "mail.example", port: 993 });
    expect(imapEndpoint({ MAIL_PROVIDER: "office365" } as Config).host).toBe("outlook.office365.com");
    expect(imapEndpoint({ MAIL_PROVIDER: "gmail" } as Config).port).toBe(993);
  });

  it("signs in to generic IMAP with the password", async () => {
    expect(await mailAuthFromConfig(imap, noTokens).credentials()).toEqual({ kind: "password", user: "me@example", password: "pw" });
  });

  it("adapts the token repo to the auth token store", async () => {
    const saved: unknown[] = [];
    const repo = { get: async () => ({ ciphertext: "c1" }), save: async (...a: unknown[]) => void saved.push(a), remove: async () => {} };
    const store = tokenStoreAdapter(repo);
    expect(await store.load("gmail")).toBe("c1");
    await store.save("office365", "c2", "2026-01-01T00:00:00.000Z");
    expect(saved).toEqual([["office365", { ciphertext: "c2", expiresAt: "2026-01-01T00:00:00.000Z" }]]);
  });
});

describe("AI wiring", () => {
  it("is logic-only without an API key", () => {
    const ai = aiFromConfig(imap, async () => 0);
    expect(ai.classifier).toBeUndefined();
    expect(ai.drafter).toBeUndefined();
    expect(ai.writeWhy).toBeUndefined();
  });

  it("builds every AI part when a key is set", () => {
    const ai = aiFromConfig({ ...imap, ANTHROPIC_API_KEY: "k", AI_DAILY_BUDGET_USD: 1 }, async () => 0, async () => { throw new Error("no calls in tests"); });
    expect(ai.classifier && ai.drafter && ai.writeWhy).toBeTruthy();
    expect(ai.costUsd()).toBe(0);
  });

  it("caps the AI why lines per run", () => {
    const run = prepareLife(lifeDeps().deps);
    expect([run.takeWhySlots(2), run.takeWhySlots(5), run.takeWhySlots(1)]).toEqual([2, 1, 0]);
  });

  it("importing the worker does not start a run", async () => {
    await expect(import("../../src/worker")).resolves.toHaveProperty("runWorker");
  });
});
