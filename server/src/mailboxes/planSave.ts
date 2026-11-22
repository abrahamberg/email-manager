import type { MailboxRecord, MailboxWrite } from "../store/mailboxes";
import type { MailboxInput } from "./input";

export type SaveError = "secret_required" | "provider_fixed";

export interface SavePlan {
  write: MailboxWrite;
  /** Plain secrets to seal; undefined keeps the saved one. */
  secrets: { clientSecret?: string; password?: string };
}

/**
 * Why: a saved secret stays only while it still goes to the same place. A new host, user or
 * client id needs the secret again, so the panel can never send a stored password elsewhere.
 */
export function planSave(id: string, input: MailboxInput, existing?: MailboxRecord): SavePlan | { error: SaveError } {
  if (existing && existing.provider !== input.provider) return { error: "provider_fixed" };
  if (input.provider === "imap") {
    const same = existing?.hasPassword && existing.imapHost === input.host && existing.imapUser === input.user;
    if (!input.password && !same) return { error: "secret_required" };
    return {
      write: {
        id, label: input.label, provider: "imap", imapHost: input.host, imapPort: input.port, imapUser: input.user,
        smtpHost: input.smtpHost, smtpPort: input.smtpPort, enabled: input.enabled,
      },
      secrets: { password: input.password },
    };
  }
  const same = existing?.hasClientSecret && existing.oauthClientId === input.clientId;
  if (!input.clientSecret && !same) return { error: "secret_required" };
  return {
    write: { id, label: input.label, provider: input.provider, oauthClientId: input.clientId, enabled: input.enabled },
    secrets: { clientSecret: input.clientSecret },
  };
}
