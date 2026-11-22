import { openGrant } from "../mail/auth/tokenStore";
import { mailboxConnection, type ConnectionDeps } from "../mailboxes/connection";
import type { MailboxService, OpenedMailbox } from "../mailboxes/service";
import type { MailboxSource } from "../pipeline/runMailbox";
import type { Store } from "../store";
import { tokenStoreAdapter } from "./tokenStoreAdapter";

export interface SourceDeps {
  service: MailboxService;
  store: Store;
  encryptionKey: Buffer;
  connection?: Partial<ConnectionDeps>;
}

/** Every enabled mailbox, each with its own cursor, undo queue and connection. */
export async function mailboxSources(deps: SourceDeps): Promise<MailboxSource[]> {
  const connection: ConnectionDeps = {
    tokenStore: (id) => tokenStoreAdapter(deps.store.tokens, id),
    encryptionKey: deps.encryptionKey,
    ...deps.connection,
  };
  const enabled = await deps.service.enabled();
  return Promise.all(enabled.map(async (m) => ({
    id: m.record.id,
    mailbox: mailboxConnection(m, connection),
    cursor: deps.store.cursorFor(m.record.id),
    pendingActions: deps.store.pendingActionsFor(m.record.id),
    address: await addressOf(m, deps),
  })));
}

/** IMAP signs in as the saved user; OAuth as the account the grant was issued to. */
async function addressOf(m: OpenedMailbox, deps: SourceDeps): Promise<string | undefined> {
  if (m.record.provider === "imap") return m.record.imapUser?.includes("@") ? m.record.imapUser : undefined;
  const token = await deps.store.tokens.get(m.record.id);
  if (!token) return undefined;
  try {
    return openGrant(token.ciphertext, deps.encryptionKey).user;
  } catch {
    return undefined;
  }
}
