import { describe, expect, it } from "vitest";
import { createApp } from "../../src/http/app";
import type { SetupDeps } from "../../src/http/routes/setup";
import type { MailboxAdmin } from "../../src/mailboxes/service";
import type { HeaderScan, Mailbox } from "../../src/ports";
import { checkConnection } from "../../src/setup/checkConnection";
import { learnFromMail } from "../../src/setup/learnFromMail";
import { readOnly, type ReadOnlyMailbox } from "../../src/setup/readOnly";
import { SetupTarget, isPublicHost } from "../../src/setup/target";
import { staticFixture } from "../http/helpers";

const NOW = new Date("2026-11-21T12:00:00Z");
const enc = (s: string) => new TextEncoder().encode(s);

function message(uid: number, from: string, receivedAt: string, extra = ""): HeaderScan {
  return { uid, receivedAt: new Date(receivedAt).toISOString(), headers: enc(`From: ${from}\r\nSubject: s${uid}\r\n${extra}`) };
}

const MESSAGES = [
  message(1, "old@a.com", "Mon, 05 Oct 2026 10:00:00 +0000"),
  message(2, "A Person <a@a.com>", "Mon, 16 Nov 2026 10:00:00 +0000"),
  message(3, "A@a.com", "Tue, 17 Nov 2026 10:00:00 +0000"),
  message(4, "news@b.com", "Wed, 18 Nov 2026 10:00:00 +0000", "List-Unsubscribe: <mailto:u@b.com>\r\nList-Id: <n.b.com>\r\n"),
  message(5, "no-reply@c.com", "Wed, 18 Nov 2026 11:00:00 +0000"),
  message(6, "news@b.com", "Thu, 19 Nov 2026 11:00:00 +0000", "List-Id: <n.b.com>\r\n"),
];

function fakeReader(opts: { fail?: unknown } = {}) {
  const log: string[] = [];
  const box: ReadOnlyMailbox = {
    async open() {
      log.push("open");
      if (opts.fail) throw opts.fail;
      return { uidValidity: 1, uidNext: 7 };
    },
    async *scanHeaders(uid) {
      log.push(`scanHeaders:${uid}`);
      for (const m of MESSAGES) if (m.uid > uid) yield m;
    },
    readMessage: async () => undefined,
    async close() { log.push("close"); },
  };
  return { box, log };
}

describe("learnFromMail", () => {
  it("counts only the last 30 days, senders without case, and newsletters", async () => {
    const { box, log } = fakeReader();
    const result = await learnFromMail(box, NOW);
    expect(result).toEqual({
      ok: true,
      summary: {
        daysRead: 30, emailsRead: 5, distinctSenders: 3, newsletters: 3, needsYou: 2,
        groups: [
          { kind: "newsletters", emails: 2, senders: 1, top: [{ sender: "news@b.com", emails: 2 }] },
          { kind: "notifications", emails: 1, senders: 1, top: [{ sender: "no-reply@c.com", emails: 1 }] },
        ],
      },
    });
    expect(log.at(-1)).toBe("close");
  });

  it("reports a code, not the server message, on failure", async () => {
    const { box } = fakeReader({ fail: Object.assign(new Error("AUTH secret-host.example"), { authenticationFailed: true }) });
    expect(await learnFromMail(box, NOW)).toEqual({ ok: false, error: "login_failed" });
  });
});

describe("checkConnection", () => {
  it.each([
    [undefined, { ok: true }],
    [Object.assign(new Error("x"), { authenticationFailed: true }), { ok: false, error: "login_failed" }],
    [new Error("ECONNREFUSED"), { ok: false, error: "unreachable" }],
  ])("%#", async (fail, expected) => {
    expect(await checkConnection(fakeReader({ fail }).box)).toEqual(expected);
  });
});

describe("readOnly", () => {
  it("exposes no way to change the mailbox", () => {
    const full = { open: async () => ({ uidValidity: 1, uidNext: 1 }), readMessage: async () => undefined, scanHeaders: async function* () {}, fetchSince: async function* () {}, close: async () => {}, moveTo: async () => {}, moveToInbox: async () => false, addLabel: async () => {}, appendDraft: async () => {} } as Mailbox;
    expect(Object.keys(readOnly(full)).sort()).toEqual(["close", "open", "readMessage", "scanHeaders"]);
  });
});

describe("SetupTarget", () => {
  const imap = { provider: "imap", host: "imap.example.com", port: 993, user: "me@example.com", password: "pw" };
  it("accepts an unsaved IMAP login or a saved mailbox", () => {
    expect(SetupTarget.safeParse(imap).success).toBe(true);
    expect(SetupTarget.safeParse({ mailboxId: "mb-1" }).success).toBe(true);
  });
  it.each([
    [{ ...imap, port: 143 }],
    [{ ...imap, host: "localhost" }],
    [{ ...imap, password: "" }],
    [{ ...imap, extra: 1 }],
    [{ provider: "gmail" }],
    [{ mailboxId: "mb-1", host: "evil.example.com" }],
    [{ mailboxId: "" }],
  ])("rejects %j", (body) => {
    expect(SetupTarget.safeParse(body).success).toBe(false);
  });
  it.each([
    ["imap.fastmail.com", true], ["8.8.8.8", true], ["127.0.0.1", false], ["10.1.2.3", false],
    ["192.168.0.5", false], ["172.20.0.1", false], ["169.254.169.254", false], ["mail", false],
    ["db.svc.cluster.local", false], ["a.internal", false], ["0x7f.0.0.1", false], ["[::1]", false],
  ])("isPublicHost(%s) is %s", (host, ok) => {
    expect(isPublicHost(host)).toBe(ok);
  });
});

describe("setup routes", () => {
  const PASSWORD = "hunter2-very-secret";
  const noAdmin: MailboxAdmin = {
    list: async () => [], create: async () => ({ ok: false, error: "secret_required" }),
    update: async () => ({ ok: false, error: "not_found" }), remove: async () => false,
  };
  function app(overrides: Partial<SetupDeps> = {}) {
    const seen: SetupTarget[] = [];
    const deps: SetupDeps = {
      oauthEnabled: true, now: () => NOW, mailboxes: noAdmin,
      reader: async (t) => (seen.push(t), "mailboxId" in t && t.mailboxId !== "mb-1" ? undefined : fakeReader().box),
      ...overrides,
    };
    const a = createApp({ allowedEmails: ["owner@example.com"], runs: { recent: async () => [] }, staticDir: staticFixture(), setup: deps });
    const post = (path: string, body: unknown) =>
      a.request(path, { method: "POST", headers: { "content-type": "application/json", "X-Auth-Request-Email": "owner@example.com" }, body: JSON.stringify(body) });
    return { a, post, seen };
  }
  const imap = { provider: "imap", host: "imap.example.com", port: 993, user: "me@example.com", password: PASSWORD };

  it("requires a signed-in user", async () => {
    expect((await app().a.request("/api/setup/status")).status).toBe(401);
  });

  it("reports whether OAuth sign-in is possible", async () => {
    const res = await app({ oauthEnabled: false }).a.request("/api/setup/status", { headers: { "X-Auth-Request-Email": "owner@example.com" } });
    expect(await res.json()).toEqual({ oauthEnabled: false });
  });

  it("tests an unsaved IMAP login, says nothing was saved, and never echoes the password", async () => {
    const res = await app().post("/api/setup/test", imap);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toMatchObject({ ok: true, note: expect.stringContaining("did not save") });
    expect(text).not.toContain(PASSWORD);
  });

  it("learns from 30 days of a saved mailbox, with no note", async () => {
    const { post, seen } = app();
    const body = await (await post("/api/setup/learn", { mailboxId: "mb-1" })).json();
    expect(seen).toEqual([{ mailboxId: "mb-1" }]);
    expect(body).toMatchObject({ ok: true, summary: { daysRead: 30, emailsRead: 5, needsYou: 2, newsletters: 3 } });
  });

  it.each([
    ["not an object", "x"], ["provider without a mailbox", { provider: "gmail" }], ["private host", { ...imap, host: "10.0.0.1" }],
    ["wrong port", { ...imap, port: 25 }],
  ])("rejects a bad body: %s", async (_n, body) => {
    expect((await app().post("/api/setup/test", body)).status).toBe(400);
    expect((await app().post("/api/setup/learn", body)).status).toBe(400);
  });

  it("answers 404 for a mailbox that is not saved", async () => {
    expect((await app().post("/api/setup/test", { mailboxId: "gone" })).status).toBe(404);
  });
});

describe("headers", () => {
  it("parses folded and repeated headers and a display-named From", async () => {
    const { parseHeaderBlock, parseFrom } = await import("../../src/mail/headerBlock");
    const h = parseHeaderBlock(enc('From: "Ann, B" <Ann@X.com>\r\nList-Id: <a>\r\n b\r\nX: 1\r\nX: 2\r\n'));
    expect(h).toEqual({ from: '"Ann, B" <Ann@X.com>', "list-id": "<a> b", x: "1\n2" });
    expect(parseFrom(h["from"])).toEqual({ name: "Ann, B", address: "ann@x.com" });
    expect(parseFrom("plain@y.org")).toEqual({ address: "plain@y.org" });
    expect(parseFrom(undefined)).toEqual({ address: "" });
  });
});
