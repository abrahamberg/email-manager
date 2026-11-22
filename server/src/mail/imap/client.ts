import { ImapFlow, type ImapFlowOptions } from "imapflow";

/** The slice of imapflow the adapter uses, so tests can inject a fake. */
export type ImapClient = Pick<
  ImapFlow,
  | "connect"
  | "logout"
  | "close"
  | "list"
  | "mailboxCreate"
  | "mailboxOpen"
  | "search"
  | "fetchOne"
  | "fetch"
  | "messageMove"
  | "messageFlagsAdd"
  | "append"
  | "usable"
  | "mailbox"
>;

export type ImapClientFactory = (options: ImapFlowOptions) => ImapClient;

export const imapflowClient: ImapClientFactory = (options) =>
  new ImapFlow({ ...options, logger: false, disableAutoIdle: true });
