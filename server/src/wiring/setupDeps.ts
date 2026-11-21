import { providers, type OAuthProviderId } from "../mail/auth/providers";
import { oauthAuth } from "../mail/auth/oauthAuth";
import { passwordAuth } from "../mail/auth/passwordAuth";
import { imapMailbox } from "../mail/imapMailbox";
import type { ConnectDeps } from "../http/routes/connect";
import type { SetupDeps } from "../http/routes/setup";
import type { Mailbox } from "../ports";
import { resolvePublic, type Lookup } from "../setup/publicAddress";
import { readOnly, type ReadOnlyMailbox } from "../setup/readOnly";
import { IMAP_TLS_PORT, type ImapTarget, type SetupTarget } from "../setup/target";

export function setupDeps(connect: ConnectDeps | undefined, lookup?: Lookup): SetupDeps {
  return {
    oauthEnabled: connect !== undefined,
    now: () => new Date(),
    connected: async () => ({
      office365: Boolean(await connect?.tokenStore.load("office365")),
      gmail: Boolean(await connect?.tokenStore.load("gmail")),
    }),
    reader: (target) => reader(target, connect, lookup),
  };
}

function reader(target: SetupTarget, connect: ConnectDeps | undefined, lookup?: Lookup) {
  if (target.provider === "imap") return pinnedImap(target, lookup);
  if (!connect) return undefined;
  return readOnly(oauthMailbox(target.provider, connect));
}

function oauthMailbox(id: OAuthProviderId, c: ConnectDeps) {
  const { host, port } = providers[id].imap;
  const auth = oauthAuth(id, c.clientId, c.clientSecret, c.tokenStore, c.encryptionKey, c.fetchImpl);
  return imapMailbox({ host, port, secure: true, auth });
}

/** Connects to the address that was checked, with the user's host name kept for TLS. */
export function pinnedImap(
  target: ImapTarget, lookup?: Lookup, open: typeof imapMailbox = imapMailbox,
): ReadOnlyMailbox {
  let inner: Promise<Mailbox> | undefined;
  const connect = () => (inner ??= resolvePublic(target.host, lookup).then((ip) => open({
    host: ip, servername: target.host, port: target.port, secure: target.port === IMAP_TLS_PORT,
    auth: passwordAuth(target.user, target.password),
  })));
  return {
    open: async () => (await connect()).open(),
    async *fetchSince(uid) {
      yield* (await connect()).fetchSince(uid);
    },
    close: async () => {
      if (inner) await (await inner.catch(() => undefined))?.close();
    },
  };
}
