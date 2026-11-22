import { lazyMailbox } from "../mail/lazyMailbox";
import { oauthAuth } from "../mail/auth/oauthAuth";
import { passwordAuth } from "../mail/auth/passwordAuth";
import { providers, type OAuthProviderId } from "../mail/auth/providers";
import type { FetchLike } from "../mail/auth/tokenEndpoint";
import type { TokenStore } from "../mail/auth/tokenStore";
import { imapMailbox } from "../mail/imapMailbox";
import type { Mailbox } from "../ports";
import { resolvePublic, type Lookup } from "../setup/publicAddress";
import { IMAP_TLS_PORT } from "../setup/target";
import type { OpenedMailbox } from "./service";

export interface ConnectionDeps {
  tokenStore: (mailboxId: string) => TokenStore;
  encryptionKey: Buffer;
  lookup?: Lookup;
  fetchImpl?: FetchLike;
  open?: typeof imapMailbox;
}

/** A missing secret fails this mailbox's own step, so the other mailboxes still run. */
export function mailboxConnection(m: OpenedMailbox, deps: ConnectionDeps): Mailbox {
  const { record } = m;
  if (record.provider === "imap") {
    const { imapHost, imapPort, imapUser } = record;
    if (!imapHost || !imapPort || !imapUser || !m.password) return failing("is missing its IMAP settings or password");
    return pinnedImap({ host: imapHost, port: imapPort, user: imapUser, password: m.password }, deps.lookup, deps.open);
  }
  if (!record.oauthClientId || !m.clientSecret) return failing("is missing its OAuth client id or secret");
  return oauthMailbox(record.provider, { clientId: record.oauthClientId, clientSecret: m.clientSecret }, record.id, deps);
}

function oauthMailbox(id: OAuthProviderId, client: { clientId: string; clientSecret: string }, mailboxId: string, deps: ConnectionDeps) {
  const { host, port } = providers[id].imap;
  const auth = oauthAuth(id, client.clientId, client.clientSecret, deps.tokenStore(mailboxId), deps.encryptionKey, deps.fetchImpl);
  return (deps.open ?? imapMailbox)({ host, port, secure: true, auth });
}

export interface ImapLogin {
  host: string;
  port: number;
  user: string;
  password: string;
}

/** Connects to the address that was checked, with the user's host name kept for TLS. */
export function pinnedImap(login: ImapLogin, lookup?: Lookup, open: typeof imapMailbox = imapMailbox): Mailbox {
  return lazyMailbox(async () => open({
    host: await resolvePublic(login.host, lookup), servername: login.host, port: login.port,
    secure: login.port === IMAP_TLS_PORT, auth: passwordAuth(login.user, login.password),
  }));
}

const failing = (why: string): Mailbox => lazyMailbox(async () => {
  throw new Error(`mailbox ${why}`);
});
