import { describe, expect, it } from "vitest";
import { smtpSender, type SmtpConfig, type SmtpTransportOptions } from "../src/mail/smtpSender";
import type { MailCredentials } from "../src/ports";

const pw: MailCredentials = { kind: "password", user: "u", password: "p" };

function setup(over: Partial<SmtpConfig> = {}, creds: MailCredentials = pw) {
  const opts: SmtpTransportOptions[] = [];
  const sent: Record<string, unknown>[] = [];
  const sender = smtpSender({
    host: "h", port: 25, secure: false, from: "bot@x.test", enabled: true,
    auth: { credentials: async () => creds },
    transportFactory: (o) => (opts.push(o), { sendMail: async (m) => void sent.push(m) }),
    ...over,
  });
  return { sender, opts, sent };
}
const mail = { to: ["a@b.test"], subject: "Re: hi", text: "yo" };

describe("smtpSender", () => {
  it("refuses when disabled, without touching transport", async () => {
    const { sender, opts } = setup({ enabled: false });
    await expect(sender.send(mail)).rejects.toThrow(/disabled/);
    expect(opts).toHaveLength(0);
  });
  it("sends with password auth and threading headers", async () => {
    const { sender, opts, sent } = setup();
    await sender.send({ ...mail, inReplyTo: "<1@x>", references: ["<0@x>", "<1@x>"] });
    expect(opts[0]?.auth).toEqual({ user: "u", pass: "p" });
    expect(opts[0]?.requireTLS).toBe(true);
    expect(sent[0]).toMatchObject({ from: "bot@x.test", to: ["a@b.test"], inReplyTo: "<1@x>", references: ["<0@x>", "<1@x>"] });
  });
  it("uses OAuth2 credentials", async () => {
    const { sender, opts } = setup({}, { kind: "oauth", user: "u", accessToken: "t" });
    await sender.send(mail);
    expect(opts[0]?.auth).toEqual({ type: "OAuth2", user: "u", accessToken: "t" });
  });
  it.each([
    ["no recipients", { to: [] }],
    ["too many", { to: Array.from({ length: 11 }, (_, i) => `a${i}@b.test`) }],
    ["display name", { to: ["Bob <a@b.test>"] }],
    ["crlf address", { to: ["a@b.test\r\nBcc: z@z.test"] }],
    ["crlf subject", { subject: "x\r\nBcc: z@z.test" }],
    ["crlf reference", { references: ["<a>\nX: y"] }],
  ])("rejects %s", async (_n, over) => {
    const { sender, sent } = setup();
    await expect(sender.send({ ...mail, ...over })).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });
});

describe.skipIf(!process.env.GREENMAIL_HOST)("smtpSender with GreenMail", () => {
  it("delivers a message", async () => {
    const sender = smtpSender({
      host: process.env.GREENMAIL_HOST!, port: 3025, secure: false, allowPlaintext: true, from: "bot@localhost", enabled: true,
      auth: { credentials: async () => pw },
    });
    await expect(sender.send({ ...mail, to: ["rcpt@localhost"] })).resolves.toBeUndefined();
  });
});
