import type { ImapClient } from "./client.js";

/** IMAP keywords are atoms: no spaces, parentheses, quotes, wildcards or backslashes. */
export function toKeyword(label: string): string {
  return label.replace(/[^\x21-\x7e]|[(){%*"\\\]]/g, "_");
}

export function headerValue(rfc822: string, name: string): string | undefined {
  const head = rfc822.split(/\r?\n\r?\n/, 1)[0] ?? "";
  const match = new RegExp(`^${name}:[ \\t]*(.+)$`, "im").exec(head);
  return match?.[1]?.trim();
}

export async function findByMessageId(c: ImapClient, folder: string, messageId: string): Promise<number[]> {
  await c.mailboxOpen(folder);
  const found = await c.search({ header: { "message-id": messageId } }, { uid: true });
  return Array.isArray(found) ? found : [];
}

// Why: append has no natural idempotency, so a retried append is detected by Message-ID.
export async function draftExists(c: ImapClient, drafts: string, messageId: string): Promise<boolean> {
  return (await findByMessageId(c, drafts, messageId)).length > 0;
}
