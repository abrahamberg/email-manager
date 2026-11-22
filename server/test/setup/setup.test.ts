import { describe, expect, it } from "vitest";
import { createApp } from "../../src/http/app";
import type { SetupDeps } from "../../src/http/routes/setup";
import type { MailboxAdmin } from "../../src/mailboxes/service";
import type { Mailbox, RawMessage } from "../../src/ports";
import { checkConnection } from "../../src/setup/checkConnection";
import { learnFromMail } from "../../src/setup/learnFromMail";
import { readOnly, type ReadOnlyMailbox } from "../../src/setup/readOnly";
import { SetupTarget, isPublicHost } from "../../src/setup/target";
import { staticFixture } from "../http/helpers";

const NOW = new Date("2026-11-21T12:00:00Z");
const enc = (s: string) => new TextEncoder().encode(s);

function message(uid: number, from: string, date: string, extra = ""): RawMessage {
  const head = `From: ${from}\r\nTo: me@example.com\r\nSubject: s${uid}\r\nMessage-ID: <m${uid}@x>\r\nDate: ${date}\r\n${extra}`;
  return { uid, source: enc(`${head}\r\nbody\r\n`) };
}

const MESSAGES = [
  message(1, "old@a.com", "Mon, 05 Oct 2026 10:00:00 +0000"),
  message(2, "a@a.com", "Mon, 16 Nov 2026 10:00:00 +0000"),
  message(3, "A@a.com", "Tue, 17 Nov 2026 10:00:00 +0000"),
  message(4, "news@b.com", "Wed, 18 Nov 2026 10:00:00 +0000", "List-Unsubscribe: <mailto:u@b.com>\r\nList-Id: <n.b.com>\r\n"),
];

function fakeReader(opts: { fail?: unknown } = {}) {
  const log: string[] = [];
  const box: ReadOnlyMailbox = {
    async open() {
      log.push("open");
      if (opts.fail) throw opts.fail;
      return { uidValidity: 1, uidNext: 5 };
    },
    async *fetchSince(uid) {
      log.push(`fetchSince:${uid}`);
      for (const m of MESSAGES) if (m.uid > uid) yield m;
    },
    async close() { log.push("close"); },
  };
  return { box, log };
}

describe("learnFromMail", () => {
  it("counts only the last 30 days, senders without case, and newsletters", async () => {
    const { box, log } = fakeReader();
    const result = await learnFromMail(box, NOW);
    expect(result).toEqual({ ok: true, summary: { daysRead: 30, emailsRead: 3, distinctSenders: 2, newsletters: 1 } });
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
    const full = { open: async () => ({ uidValidity: 1, uidNext: 1 }), fetchSince: async function* () {}, close: async () => {}, moveTo: async () => {}, moveToInbox: async () => false, addLabel: async () => {}, appendDraft: async () => {} } as Mailbox;
    expect(Object.keys(readOnly(full)).sort()).toEqual(["close", "fetchSince", "open"]);
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
    expect(body).toEqual({ ok: true, summary: { daysRead: 30, emailsRead: 3, distinctSenders: 2, newsletters: 1 } });
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
