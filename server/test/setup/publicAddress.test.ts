import { describe, expect, it } from "vitest";
import type { ImapMailboxOptions } from "../../src/mail/imapMailbox";
import type { Mailbox } from "../../src/ports";
import { isPublicIp, resolvePublic } from "../../src/setup/publicAddress";
import { pinnedImap } from "../../src/wiring/setupDeps";

describe("isPublicIp", () => {
  it.each([
    ["93.184.216.34", true],
    ["10.0.0.5", false],
    ["127.0.0.1", false],
    ["169.254.169.254", false],
    ["100.100.1.1", false],
    ["198.18.0.1", false],
    ["2606:2800:220:1::1", true],
    ["::1", false],
    ["::", false],
    ["fd00::1", false],
    ["fe80::1", false],
    ["::ffff:10.0.0.1", false],
    ["::ffff:93.184.216.34", true],
    ["64:ff9b::a00:1", false],
    ["2002:a00:1::1", false],
    ["not-an-ip", false],
  ])("%s → %s", (ip, ok) => expect(isPublicIp(ip)).toBe(ok));
});

describe("resolvePublic", () => {
  const answers = (...ips: string[]) => async () => ips.map((address) => ({ address }));

  it("returns the first address when every answer is public", async () => {
    await expect(resolvePublic("imap.example.com", answers("93.184.216.34", "2606:2800:220:1::1"))).resolves.toBe("93.184.216.34");
  });

  it.each([[["93.184.216.34", "10.0.0.1"]], [["127.0.0.1"]], [[]]])("refuses %j", async (ips) => {
    await expect(resolvePublic("imap.example.com", answers(...ips))).rejects.toThrow();
  });
});

describe("pinnedImap", () => {
  const target = { provider: "imap" as const, host: "imap.example.com", port: 993 as const, user: "u", password: "p" };

  it("connects to the checked address and keeps the name for TLS", async () => {
    const seen: ImapMailboxOptions[] = [];
    const open = (o: ImapMailboxOptions) => (seen.push(o), { open: async () => ({ uidValidity: 1, uidNext: 1 }), close: async () => {} }) as unknown as Mailbox;
    const box = pinnedImap(target, async () => [{ address: "93.184.216.34" }], open);
    await box.open();
    await box.close();
    expect(seen).toMatchObject([{ host: "93.184.216.34", servername: "imap.example.com", secure: true }]);
  });

  it("never connects when the name resolves to a private address", async () => {
    let connected = false;
    const open = () => ((connected = true), {}) as Mailbox;
    const box = pinnedImap(target, async () => [{ address: "10.0.0.7" }], open);
    await expect(box.open()).rejects.toThrow();
    await box.close();
    expect(connected).toBe(false);
  });
});
