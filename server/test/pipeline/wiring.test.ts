import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config";
import type { ImapMailboxOptions } from "../../src/mail/imapMailbox";
import { mailboxConnection } from "../../src/mailboxes/connection";
import type { OpenedMailbox } from "../../src/mailboxes/service";
import { prepareLife } from "../../src/pipeline/lifeDeps";
import type { Mailbox } from "../../src/ports";
import type { MailboxRecord } from "../../src/store/mailboxes";
import { aiFromConfig } from "../../src/wiring/aiFromConfig";
import { tokenStoreAdapter } from "../../src/wiring/tokenStoreAdapter";
import { lifeDeps } from "./lifeFakes";

const imap = { ALLOWED_EMAILS: ["me@example"], AI_DAILY_BUDGET_USD: 0.5 } as Config;
const noTokens = { load: async () => undefined, save: async () => undefined };
const record = (over: Partial<MailboxRecord>): MailboxRecord => ({
  id: "mb-1", label: "Work", provider: "imap", hasClientSecret: false, hasPassword: false, enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

function connect(m: OpenedMailbox) {
  const seen: ImapMailboxOptions[] = [];
  const open = (o: ImapMailboxOptions) =>
    (seen.push(o), { open: async () => ({ uidValidity: 1, uidNext: 1 }), close: async () => {} }) as unknown as Mailbox;
  const box = mailboxConnection(m, {
    tokenStore: () => noTokens, encryptionKey: Buffer.alloc(32), lookup: async () => [{ address: "93.184.216.34" }], open,
  });
  return { box, seen };
}

describe("mailbox connections", () => {
  it("signs in to a saved IMAP mailbox at the checked address with its password", async () => {
    const { box, seen } = connect({ record: record({ imapHost: "mail.example.com", imapPort: 993, imapUser: "me" }), password: "pw" });
    await box.open();
    expect(seen).toMatchObject([{ host: "93.184.216.34", servername: "mail.example.com", port: 993, secure: true }]);
    expect(await seen[0]!.auth.credentials()).toEqual({ kind: "password", user: "me", password: "pw" });
  });

  it("uses the provider's own host for OAuth mailboxes", async () => {
    const { box, seen } = connect({ record: record({ provider: "gmail", oauthClientId: "cid" }), clientSecret: "s" });
    await box.open();
    expect(seen).toMatchObject([{ host: "imap.gmail.com", port: 993, secure: true }]);
  });

  it.each([
    ["an IMAP mailbox without a password", { record: record({ imapHost: "mail.example.com", imapPort: 993, imapUser: "me" }) }],
    ["an OAuth mailbox without a secret", { record: record({ provider: "office365", oauthClientId: "cid" }) }],
  ])("fails only when used: %s", async (_n, m) => {
    const { box, seen } = connect(m);
    await expect(box.open()).rejects.toThrow("missing");
    await box.close();
    expect(seen).toEqual([]);
  });

  it("adapts the token repo to one mailbox's token store", async () => {
    const saved: unknown[] = [];
    const repo = { get: async (id: string) => (id === "mb-1" ? { ciphertext: "c1" } : undefined), save: async (...a: unknown[]) => void saved.push(a), remove: async () => {} };
    const store = tokenStoreAdapter(repo, "mb-1");
    expect(await store.load()).toBe("c1");
    expect(await tokenStoreAdapter(repo, "mb-2").load()).toBeUndefined();
    await store.save("c2", "2026-01-01T00:00:00.000Z");
    expect(saved).toEqual([["mb-1", { ciphertext: "c2", expiresAt: "2026-01-01T00:00:00.000Z" }]]);
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
    const ai = aiFromConfig({ ...imap, OPENAI_API_KEY: "k", AI_DAILY_BUDGET_USD: 1 }, async () => 0, async () => { throw new Error("no calls in tests"); });
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
