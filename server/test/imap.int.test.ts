import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ImapFlow } from "imapflow";
import { imapMailbox } from "../src/mail/imapMailbox.js";
import type { MailAuth, Mailbox } from "../src/ports.js";

// Runs against GreenMail (CI service container); skipped when GREENMAIL_HOST is unset.
const host = process.env.GREENMAIL_HOST;
const port = Number(process.env.GREENMAIL_IMAP_PORT ?? 3143);
const user = process.env.GREENMAIL_USER ?? "test";
const password = process.env.GREENMAIL_PASSWORD ?? "test";
const auth: MailAuth = { credentials: async () => ({ kind: "password", user, password }) };

const run = `t${Date.now()}`;
const folder = `Work-${run}`;
const message = (n: number) => `Message-ID: <${run}-${n}@test>\r\nFrom: a@test\r\nTo: ${user}@localhost\r\nSubject: ${run} ${n}\r\n\r\nbody ${n}\r\n`;

const admin = () => new ImapFlow({ host: host!, port, secure: false, auth: { user, pass: password }, logger: false });
const open = (inbox = folder) => imapMailbox({ host: host!, port, secure: false, allowPlaintext: true, auth, folders: { inbox } });

async function uids(m: Mailbox, since: number) {
  const out: number[] = [];
  for await (const msg of m.fetchSince(since)) out.push(msg.uid);
  return out;
}

async function inFolder(c: ImapFlow, path: string, messageId: string) {
  await c.mailboxOpen(path);
  const found = await c.search({ header: { "message-id": messageId } }, { uid: true });
  return Array.isArray(found) ? found : [];
}

describe.skipIf(!host)("imapMailbox against GreenMail", () => {
  const c = admin();
  let mailbox: Mailbox;

  beforeAll(async () => {
    await c.connect();
    await c.mailboxCreate(folder);
    for (const n of [1, 2, 3]) await c.append(folder, message(n));
    mailbox = open();
  });

  afterAll(async () => {
    await mailbox?.close();
    await c.logout();
  });

  it("fetches messages after the last UID, in UID order", async () => {
    const state = await mailbox.open();
    const all = await uids(mailbox, 0);
    expect(all).toHaveLength(3);
    expect([...all].sort((a, b) => a - b)).toEqual(all);
    expect(state.uidNext).toBeGreaterThan(all[2]!);
    expect(await uids(mailbox, all[0]!)).toEqual(all.slice(1));
    expect(await uids(mailbox, all[2]!)).toEqual([]);
  });

  it("labels with an IMAP keyword, idempotently", async () => {
    const [uid] = await uids(mailbox, 0);
    await mailbox.addLabel(uid!, "newsletter");
    await mailbox.addLabel(uid!, "newsletter");
    await c.mailboxOpen(folder);
    const msg = await c.fetchOne(String(uid), { flags: true }, { uid: true });
    expect(msg && [...(msg.flags ?? [])]).toContain("newsletter");
  });

  it("moves to Junk, and a retry is a no-op", async () => {
    const [uid] = await uids(mailbox, 0);
    await mailbox.moveTo(uid!, "junk");
    await mailbox.moveTo(uid!, "junk");
    expect(await uids(mailbox, 0)).not.toContain(uid);
    expect(await inFolder(c, "Junk", `<${run}-1@test>`)).toHaveLength(1);
  });

  it("moves a message back from Junk by Message-ID, and a retry finds nothing", async () => {
    const id = `<${run}-1@test>`;
    expect(await mailbox.moveToInbox(id, "junk")).toBe(true);
    expect(await mailbox.moveToInbox(id, "junk")).toBe(false);
    expect(await inFolder(c, "Junk", id)).toHaveLength(0);
    expect(await inFolder(c, folder, id)).toHaveLength(1);
  });

  it("appends a draft once with Draft and Seen flags", async () => {
    const draft = `Message-ID: <${run}-draft@test>\r\nSubject: re\r\n\r\nhi\r\n`;
    await mailbox.appendDraft(draft);
    await mailbox.appendDraft(draft);
    const found = await inFolder(c, "Drafts", `<${run}-draft@test>`);
    expect(found).toHaveLength(1);
    const msg = await c.fetchOne(String(found[0]), { flags: true }, { uid: true });
    expect(msg && [...(msg.flags ?? [])]).toEqual(expect.arrayContaining(["\\Draft", "\\Seen"]));
  });

  it("reports a new UIDVALIDITY when the folder is recreated", async () => {
    const recreated = `Gone-${run}`;
    await c.mailboxCreate(recreated);
    // STATUS, not SELECT: GreenMail 2.1.3 cannot delete a folder any session has selected.
    const before = (await c.status(recreated, { uidValidity: true })).uidValidity;
    await c.mailboxDelete(recreated);
    await new Promise((r) => setTimeout(r, 1100));
    await c.mailboxCreate(recreated);
    await c.append(recreated, message(9));
    const second = open(recreated);
    const after = await second.open();
    expect(after.uidValidity).not.toBe(Number(before));
    expect(await uids(second, 0)).toHaveLength(1);
    await second.close();
  });
});
