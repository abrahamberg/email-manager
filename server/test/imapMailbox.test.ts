import { describe, expect, it } from "vitest";
import type { ImapFlowOptions } from "imapflow";
import { imapMailbox, toKeyword } from "../src/mail/imapMailbox.js";
import type { ImapClient } from "../src/mail/imap/client.js";
import type { MailAuth } from "../src/ports.js";

interface Msg { source: Buffer; flags: Set<string> }
interface Box { uidValidity: bigint; uidNext: number; messages: Map<number, Msg>; specialUse?: string }

function fakeServer(boxes: Record<string, Box>) {
  const logins: ImapFlowOptions["auth"][] = [];
  const box = (p: string) => boxes[p] ?? (() => { throw new Error(`no mailbox ${p}`); })();
  const factory = (opts: ImapFlowOptions): ImapClient => {
    let selected: string | undefined;
    const cur = () => box(selected ?? "");
    const client = {
      usable: false,
      mailbox: false as ImapClient["mailbox"],
      async connect() { logins.push(opts.auth); client.usable = true; },
      async logout() { client.usable = false; },
      close() { client.usable = false; },
      async list() {
        return Object.entries(boxes).map(([path, b]) => ({ path, name: path, flags: new Set<string>(), specialUse: b.specialUse }));
      },
      async mailboxCreate(path: string) { boxes[path] ??= { uidValidity: 1n, uidNext: 1, messages: new Map() }; return { path, created: true }; },
      async mailboxOpen(path: string) {
        selected = path;
        const b = box(path);
        client.mailbox = { path, uidValidity: b.uidValidity, uidNext: b.uidNext } as never;
        return client.mailbox;
      },
      async search(q: { uid?: string; header?: Record<string, string> }) {
        const all = [...cur().messages.entries()];
        if (q.header) {
          const id = q.header["message-id"]!;
          return all.filter(([, m]) => m.source.toString().includes(id)).map(([u]) => u);
        }
        const [lo, hi] = q.uid!.split(":");
        const max = Math.max(0, ...cur().messages.keys());
        const a = Number(lo), b = hi === "*" ? max : Number(hi ?? lo);
        const [from, to] = [Math.min(a, b), Math.max(a, b)];
        return all.map(([u]) => u).filter((u) => u >= from && u <= to);
      },
      async fetchOne(uid: string) {
        const m = cur().messages.get(Number(uid));
        return m ? { uid: Number(uid), seq: 1, source: m.source } : false;
      },
      async messageMove(uid: string, dest: string) {
        const m = cur().messages.get(Number(uid))!;
        cur().messages.delete(Number(uid));
        const d = box(dest);
        d.messages.set(d.uidNext++, m);
        return { path: selected!, destination: dest };
      },
      async messageFlagsAdd(uid: string, flags: string[]) {
        const m = cur().messages.get(Number(uid));
        flags.forEach((f) => m?.flags.add(f));
        return true;
      },
      async append(path: string, content: string, flags: string[]) {
        const d = box(path);
        d.messages.set(d.uidNext++, { source: Buffer.from(content), flags: new Set(flags) });
        return { destination: path };
      },
    };
    return client as unknown as ImapClient;
  };
  return { factory, logins };
}

const inboxWith = (n: number): Box => ({
  uidValidity: 7n,
  uidNext: n + 1,
  messages: new Map(Array.from({ length: n }, (_, i) => [i + 1, { source: Buffer.from(`Subject: ${i + 1}\r\n\r\nx`), flags: new Set<string>() }])),
});

const auth: MailAuth = { credentials: async () => ({ kind: "password", user: "u", password: "p" }) };
const setup = (boxes: Record<string, Box>, a = auth) => {
  const s = fakeServer(boxes);
  return { ...s, mailbox: imapMailbox({ host: "h", port: 1, secure: false, auth: a }, s.factory) };
};

async function collect(it: AsyncIterable<{ uid: number }>) {
  const out: number[] = [];
  for await (const m of it) out.push(m.uid);
  return out;
}

describe("imapMailbox", () => {
  it("opens INBOX and reports its state", async () => {
    const { mailbox } = setup({ INBOX: inboxWith(3) });
    expect(await mailbox.open()).toEqual({ uidValidity: 7, uidNext: 4 });
  });

  it.each([[0, [1, 2, 3]], [1, [2, 3]], [3, []], [10, []]])("fetchSince(%i) yields %j", async (since, uids) => {
    const { mailbox } = setup({ INBOX: inboxWith(3) });
    expect(await collect(mailbox.fetchSince(since))).toEqual(uids);
  });

  it("allows moving messages while iterating", async () => {
    const boxes = { INBOX: inboxWith(3), Spam: { ...inboxWith(0), specialUse: "\\Junk" } };
    const { mailbox } = setup(boxes);
    for await (const m of mailbox.fetchSince(0)) await mailbox.moveTo(m.uid, "junk");
    expect(boxes.INBOX.messages.size).toBe(0);
    expect(boxes.Spam.messages.size).toBe(3);
  });

  it("finds folders by common names and creates missing ones", async () => {
    const boxes: Record<string, Box> = { INBOX: inboxWith(1), "Junk Email": inboxWith(0) };
    const { mailbox } = setup(boxes);
    await mailbox.moveTo(1, "archive");
    expect(boxes.Archive?.messages.size).toBe(1);
    expect(Object.keys(boxes)).toContain("Drafts");
  });

  it("moveTo and addLabel are no-ops for a missing UID and safe to retry", async () => {
    const boxes = { INBOX: inboxWith(1), Junk: inboxWith(0) };
    const { mailbox } = setup(boxes);
    await mailbox.addLabel(1, "news letter");
    await mailbox.addLabel(1, "news letter");
    expect([...boxes.INBOX.messages.get(1)!.flags]).toEqual(["news_letter"]);
    await mailbox.moveTo(1, "junk");
    await mailbox.moveTo(1, "junk");
    await mailbox.addLabel(1, "x");
    expect(boxes.Junk.messages.size).toBe(1);
  });

  it("appends a draft once per Message-ID with Draft and Seen flags", async () => {
    const boxes = { INBOX: inboxWith(1), Drafts: inboxWith(0) };
    const { mailbox } = setup(boxes);
    const draft = "Message-ID: <a@b>\r\nSubject: re\r\n\r\nhi";
    await mailbox.appendDraft(draft);
    await mailbox.appendDraft(draft);
    expect(boxes.Drafts.messages.size).toBe(1);
    expect([...boxes.Drafts.messages.get(1)!.flags]).toEqual(["\\Draft", "\\Seen"]);
    expect(await collect(mailbox.fetchSince(0))).toEqual([1]);
  });

  it("asks MailAuth for credentials on each connect, using XOAUTH2 tokens", async () => {
    let n = 0;
    const oauth: MailAuth = { credentials: async () => ({ kind: "oauth", user: "u", accessToken: `t${++n}` }) };
    const { mailbox, logins } = setup({ INBOX: inboxWith(0) }, oauth);
    await mailbox.open();
    await mailbox.close();
    await mailbox.open();
    expect(logins).toEqual([{ user: "u", accessToken: "t1" }, { user: "u", accessToken: "t2" }]);
  });

  it.each([["a b(c)", "a_b_c_"], ["ok-1", "ok-1"], ['q"\\*%', "q____"]])("toKeyword(%j) = %j", (l, k) => {
    expect(toKeyword(l)).toBe(k);
  });
});
