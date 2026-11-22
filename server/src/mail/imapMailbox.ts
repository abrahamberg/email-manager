import type { HeaderScan, MailAuth, MailCredentials, Mailbox, MailboxState, RawMessage } from "../ports.js";
import { imapflowClient, type ImapClient, type ImapClientFactory } from "./imap/client.js";
import { resolveFolders, type Folders } from "./imap/folders.js";

/** The headers bulk detection and sender grouping read; nothing else leaves the server. */
const SCAN_HEADERS = ["from", "list-id", "list-unsubscribe", "precedence", "auto-submitted", "x-auto-response-suppress"];

export interface ImapMailboxOptions {
  host: string;
  port: number;
  secure: boolean;
  auth: MailAuth;
  folders?: Partial<Folders>;
  /** The certificate name when `host` is an IP the caller already resolved and checked. */
  servername?: string;
  /** Test servers only: allows a connection that never upgrades to TLS. */
  allowPlaintext?: boolean;
}

/**
 * UIDVALIDITY contract: open() reports the INBOX uidValidity and the adapter keeps no
 * cursor of its own. When it differs from the caller's stored cursor, every stored UID
 * is void and the caller must pick a new starting point (fetchSince(0) refetches all).
 */
export function imapMailbox(options: ImapMailboxOptions, createClient: ImapClientFactory = imapflowClient): Mailbox {
  let client: ImapClient | undefined;
  let folders: Folders | undefined;

  async function connection(): Promise<{ client: ImapClient; folders: Folders }> {
    if (!client?.usable) {
      // Fresh credentials on every connect, so an OAuth token refreshed by MailAuth is picked up.
      const next = createClient({ ...transport(options), auth: toAuth(await options.auth.credentials()) });
      await next.connect();
      client = next;
      folders = undefined;
    }
    folders ??= await resolveFolders(client, options.folders);
    return { client, folders };
  }

  async function inbox(): Promise<{ client: ImapClient; folders: Folders }> {
    const c = await connection();
    const selected = c.client.mailbox;
    if (!selected || selected.path !== c.folders.inbox) await c.client.mailboxOpen(c.folders.inbox);
    return c;
  }

  async function existing(c: ImapClient, uid: number): Promise<boolean> {
    const found = await c.search({ uid: String(uid) }, { uid: true });
    return Array.isArray(found) && found.includes(uid);
  }

  return {
    async open(): Promise<MailboxState> {
      const c = await connection();
      const box = await c.client.mailboxOpen(c.folders.inbox);
      return { uidValidity: Number(box.uidValidity), uidNext: box.uidNext };
    },

    async *fetchSince(uid: number): AsyncIterable<RawMessage> {
      // UIDs first, then one FETCH per message: memory stays flat and the caller may
      // move or label between messages, which imapflow forbids inside a fetch() loop.
      const found = await (await inbox()).client.search({ uid: `${uid + 1}:*` }, { uid: true });
      const uids = (Array.isArray(found) ? found : []).filter((u) => u > uid).sort((a, b) => a - b);
      for (const next of uids) {
        const msg = await (await inbox()).client.fetchOne(String(next), { uid: true, source: true }, { uid: true });
        if (msg && msg.source) yield { uid: msg.uid, source: new Uint8Array(msg.source) };
      }
    },

    async *scanHeaders(uid: number): AsyncIterable<HeaderScan> {
      const c = (await inbox()).client;
      for await (const msg of c.fetch(`${uid + 1}:*`, { uid: true, internalDate: true, headers: SCAN_HEADERS }, { uid: true })) {
        if (msg.uid <= uid || !msg.headers) continue;
        const received = msg.internalDate instanceof Date ? msg.internalDate : new Date(msg.internalDate ?? 0);
        yield { uid: msg.uid, receivedAt: received.toISOString(), headers: new Uint8Array(msg.headers) };
      }
    },

    async moveTo(uid, folder) {
      const { client: c, folders: f } = await inbox();
      if (!(await existing(c, uid))) return;
      await c.messageMove(String(uid), f[folder], { uid: true });
    },

    async moveToInbox(messageId, from) {
      if (!messageId.trim()) return false;
      const c = await connection();
      const found = await findByMessageId(c.client, c.folders[from], messageId);
      for (const uid of found) await c.client.messageMove(String(uid), c.folders.inbox, { uid: true });
      return found.length > 0;
    },

    async addLabel(uid, label) {
      const { client: c } = await inbox();
      if (!(await existing(c, uid))) return;
      await c.messageFlagsAdd(String(uid), [toKeyword(label)], { uid: true });
    },

    async appendDraft(rfc822) {
      const c = await connection();
      const messageId = headerValue(rfc822, "message-id");
      if (messageId && (await draftExists(c.client, c.folders.drafts, messageId))) return;
      await c.client.append(c.folders.drafts, rfc822, ["\\Draft", "\\Seen"]);
    },

    async close() {
      const c = client;
      client = undefined;
      if (c?.usable) await c.logout();
      else c?.close();
    },
  };
}

// Why: without doSTARTTLS a man in the middle can strip the STARTTLS offer and read the password.
function transport(o: ImapMailboxOptions) {
  return {
    host: o.host, port: o.port, secure: o.secure,
    ...(o.servername && { servername: o.servername }),
    ...(!o.secure && !o.allowPlaintext && { doSTARTTLS: true }),
  };
}

function toAuth(creds: MailCredentials) {
  return creds.kind === "password"
    ? { user: creds.user, pass: creds.password }
    : { user: creds.user, accessToken: creds.accessToken };
}

/** IMAP keywords are atoms: no spaces, parentheses, quotes, wildcards or backslashes. */
export function toKeyword(label: string): string {
  return label.replace(/[^\x21-\x7e]|[(){%*"\\\]]/g, "_");
}

function headerValue(rfc822: string, name: string): string | undefined {
  const head = rfc822.split(/\r?\n\r?\n/, 1)[0] ?? "";
  const match = new RegExp(`^${name}:[ \\t]*(.+)$`, "im").exec(head);
  return match?.[1]?.trim();
}

async function findByMessageId(c: ImapClient, folder: string, messageId: string): Promise<number[]> {
  await c.mailboxOpen(folder);
  const found = await c.search({ header: { "message-id": messageId } }, { uid: true });
  return Array.isArray(found) ? found : [];
}

// Why: append has no natural idempotency, so a retried append is detected by Message-ID.
async function draftExists(c: ImapClient, drafts: string, messageId: string): Promise<boolean> {
  return (await findByMessageId(c, drafts, messageId)).length > 0;
}
