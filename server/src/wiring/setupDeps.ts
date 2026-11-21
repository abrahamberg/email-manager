import { providers, type OAuthProviderId } from "../mail/auth/providers";
import { oauthAuth } from "../mail/auth/oauthAuth";
import { passwordAuth } from "../mail/auth/passwordAuth";
import { imapMailbox } from "../mail/imapMailbox";
import type { ConnectDeps } from "../http/routes/connect";
import type { SetupDeps } from "../http/routes/setup";
import { readOnly } from "../setup/readOnly";
import { IMAP_TLS_PORT, type SetupTarget } from "../setup/target";

export function setupDeps(connect: ConnectDeps | undefined): SetupDeps {
  return {
    oauthEnabled: connect !== undefined,
    now: () => new Date(),
    connected: async () => ({
      office365: Boolean(await connect?.tokenStore.load("office365")),
      gmail: Boolean(await connect?.tokenStore.load("gmail")),
    }),
    reader: (target) => reader(target, connect),
  };
}

function reader(target: SetupTarget, connect: ConnectDeps | undefined) {
  if (target.provider === "imap") {
    const auth = passwordAuth(target.user, target.password);
    return readOnly(imapMailbox({ host: target.host, port: target.port, secure: target.port === IMAP_TLS_PORT, auth }));
  }
  if (!connect) return undefined;
  return readOnly(oauthMailbox(target.provider, connect));
}

function oauthMailbox(id: OAuthProviderId, c: ConnectDeps) {
  const { host, port } = providers[id].imap;
  const auth = oauthAuth(id, c.clientId, c.clientSecret, c.tokenStore, c.encryptionKey, c.fetchImpl);
  return imapMailbox({ host, port, secure: true, auth });
}
