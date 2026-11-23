import { describe, expect, it } from "vitest";
import { ImapInput, MailboxInput } from "../../src/mailboxes/input";
import { planSave } from "../../src/mailboxes/planSave";
import type { MailboxRecord } from "../../src/store/mailboxes";

const savedImap: MailboxRecord = {
  id: "mb-1", label: "Home", provider: "imap", imapHost: "imap.example.com", imapPort: 993, imapUser: "me",
  hasClientSecret: false, hasPassword: true, enabled: true, createdAt: "2026-01-01T00:00:00.000Z",
};
const savedGmail: MailboxRecord = { ...savedImap, provider: "gmail", imapHost: undefined, imapUser: undefined, oauthClientId: "cid", hasPassword: false, hasClientSecret: true };
const imap = ImapInput.parse({ provider: "imap", label: "Home", host: "imap.example.com", port: 993, user: "me" });
const gmail = MailboxInput.parse({ provider: "gmail", label: "Mail", clientId: "cid" });

describe("planSave", () => {
  it.each([
    ["a new IMAP mailbox without a password", imap, undefined, "secret_required"],
    ["a new OAuth mailbox without a secret", gmail, undefined, "secret_required"],
    ["a new IMAP host with the old password", { ...imap, host: "other.example.com" }, savedImap, "secret_required"],
    ["a new IMAP user with the old password", { ...imap, user: "you" }, savedImap, "secret_required"],
    ["a new client id with the old secret", { ...gmail, clientId: "cid2" }, savedGmail, "secret_required"],
    ["a provider change", gmail, savedImap, "provider_fixed"],
  ] as const)("refuses %s", (_n, input, existing, error) => {
    expect(planSave("mb-1", input, existing)).toEqual({ error });
  });

  it.each([
    ["the IMAP password", imap, savedImap, { password: undefined }],
    ["the client secret", { ...gmail, label: "Renamed" }, savedGmail, { clientSecret: undefined }],
  ] as const)("keeps %s when the edit leaves it out and nothing it goes to changed", (_n, input, existing, secrets) => {
    const plan = planSave("mb-1", input, existing);
    expect("secrets" in plan && plan.secrets).toEqual(secrets);
  });

  it("keeps the tenant of an Office 365 mailbox", () => {
    const plan = planSave("mb-3", MailboxInput.parse({ provider: "office365", label: "W", clientId: "cid", clientSecret: "s", tenant: " contoso.com " }));
    expect("write" in plan && plan.write.oauthTenant).toBe("contoso.com");
  });

  it("writes only the fields of its provider", () => {
    const plan = planSave("mb-2", { ...imap, password: "pw", smtpHost: "smtp.example.com", smtpPort: 587 });
    expect("write" in plan && plan.write).toEqual({
      id: "mb-2", label: "Home", provider: "imap", imapHost: "imap.example.com", imapPort: 993, imapUser: "me",
      smtpHost: "smtp.example.com", smtpPort: 587, enabled: true,
    });
  });
});

describe("MailboxInput", () => {
  it.each([
    [{ provider: "imap", label: "x", host: "10.0.0.1", port: 993, user: "me" }],
    [{ provider: "imap", label: "x", host: "imap.example.com", port: 143, user: "me" }],
    [{ provider: "imap", label: "x", host: "imap.example.com", port: 993, user: "me", smtpHost: "db.svc.cluster.local" }],
    [{ provider: "imap", label: "x", host: "imap.example.com", port: 993, user: "me", smtpPort: 25 }],
    [{ provider: "gmail", label: "x", clientId: "c", host: "imap.example.com" }],
    [{ provider: "yahoo", label: "x" }],
    [{ provider: "gmail", label: "", clientId: "c" }],
    [{ provider: "gmail", label: "x", clientId: "c", tenant: "contoso.com" }],
    [{ provider: "office365", label: "x", clientId: "c", tenant: "evil.example/x?y" }],
  ])("rejects %j", (body) => {
    expect(MailboxInput.safeParse(body).success).toBe(false);
  });
});
