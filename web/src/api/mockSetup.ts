import type { MailboxInput, MailboxView, SetupApi } from "./setupApi";

const UNSAVED_NOTE = "This check did not save anything. Add the mailbox to keep these settings; the password is stored encrypted.";

let saved: MailboxView[] = [];
let next = 1;

function toView(input: MailboxInput, id: string, before?: MailboxView): MailboxView {
  const base = { id, label: input.label, enabled: input.enabled, connected: before?.connected ?? false };
  if (input.provider === "imap") {
    return {
      ...base, provider: "imap", imapHost: input.host, imapPort: input.port, imapUser: input.user, smtpHost: input.smtpHost,
      smtpPort: input.smtpPort, hasPassword: Boolean(input.password) || Boolean(before?.hasPassword), hasClientSecret: false,
    };
  }
  return {
    ...base, provider: input.provider, oauthClientId: input.clientId, hasPassword: false,
    hasClientSecret: Boolean(input.clientSecret) || Boolean(before?.hasClientSecret),
  };
}

/** In memory, so the panel's Set up works without a server. */
export const mockSetupApi: SetupApi = {
  async status() {
    return { oauthEnabled: true };
  },
  async mailboxes() {
    return structuredClone(saved);
  },
  async saveMailbox(input, id) {
    const before = saved.find((m) => m.id === id);
    if (id && !before) return { ok: false, error: "not_found" };
    const secret = input.provider === "imap" ? input.password : input.clientSecret;
    if (!secret && !before) return { ok: false, error: "secret_required" };
    const view = toView(input, id ?? `mb-${next++}`, before);
    saved = before ? saved.map((m) => (m.id === id ? view : m)) : [...saved, view];
    return { ok: true, mailbox: structuredClone(view) };
  },
  async removeMailbox(id) {
    saved = saved.filter((m) => m.id !== id);
  },
  async test(target) {
    if ("mailboxId" in target && !saved.some((m) => m.id === target.mailboxId)) return { ok: false, error: "not_found" };
    return "provider" in target ? { ok: true, note: UNSAVED_NOTE } : { ok: true };
  },
  async learn() {
    return { ok: true, summary: { daysRead: 30, emailsRead: 1284, distinctSenders: 212, newsletters: 96 } };
  },
};
