import type { ConnectDeps, MailboxClient } from "../http/routes/connect";
import type { SetupDeps } from "../http/routes/setup";
import { mailboxConnection, pinnedImap, type ConnectionDeps } from "../mailboxes/connection";
import type { MailboxService } from "../mailboxes/service";
import type { Lookup } from "../setup/publicAddress";
import { readOnly } from "../setup/readOnly";
import type { SetupTarget } from "../setup/target";
import type { Store } from "../store";
import { tokenStoreAdapter } from "./tokenStoreAdapter";

export interface PanelMailDeps {
  service: MailboxService;
  tokens: Store["tokens"];
  encryptionKey: Buffer;
  publicUrl?: string;
  lookup?: Lookup;
}

export function setupDeps(d: PanelMailDeps, now: () => Date = () => new Date()): SetupDeps {
  const connection: ConnectionDeps = { tokenStore: (id) => tokenStoreAdapter(d.tokens, id), encryptionKey: d.encryptionKey, lookup: d.lookup };
  return {
    mailboxes: d.service.admin,
    oauthEnabled: d.publicUrl !== undefined,
    now,
    reader: (target) => reader(target, d.service, connection),
  };
}

async function reader(target: SetupTarget, service: MailboxService, connection: ConnectionDeps) {
  if ("provider" in target) return readOnly(pinnedImap(target, connection.lookup));
  const saved = await service.opened(target.mailboxId);
  return saved && readOnly(mailboxConnection(saved, connection));
}

/** Undefined without PUBLIC_URL: the providers need a fixed redirect address. */
export function connectDeps(d: PanelMailDeps): ConnectDeps | undefined {
  if (!d.publicUrl) return undefined;
  return {
    publicUrl: d.publicUrl,
    encryptionKey: d.encryptionKey,
    client: async (mailboxId): Promise<MailboxClient | undefined> => {
      const m = await d.service.opened(mailboxId);
      const r = m?.record;
      if (!r || r.provider === "imap" || !r.oauthClientId || !m.clientSecret) return undefined;
      return {
        provider: r.provider, clientId: r.oauthClientId, clientSecret: m.clientSecret, tenant: r.oauthTenant,
        tokenStore: tokenStoreAdapter(d.tokens, r.id),
      };
    },
  };
}
