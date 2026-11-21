import type { Config } from "../config";
import { providers } from "../mail/auth/providers";
import { imapMailbox } from "../mail/imapMailbox";
import type { MailAuth, Mailbox } from "../ports";
import { required } from "./mailAuthFromConfig";

const IMPLICIT_TLS_PORT = 993;

export function imapEndpoint(config: Config): { host: string; port: number } {
  if (config.MAIL_PROVIDER === "imap") return { host: required(config.IMAP_HOST), port: required(config.IMAP_PORT) };
  return providers[config.MAIL_PROVIDER].imap;
}

export function mailboxFromConfig(config: Config, auth: MailAuth): Mailbox {
  const { host, port } = imapEndpoint(config);
  return imapMailbox({ host, port, secure: port === IMPLICIT_TLS_PORT, auth });
}
