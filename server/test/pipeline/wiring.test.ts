import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config";
import { mailAuthFromConfig } from "../../src/wiring/mailAuthFromConfig";
import { imapEndpoint } from "../../src/wiring/mailboxFromConfig";
import { tokenStoreAdapter } from "../../src/wiring/tokenStoreAdapter";

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
