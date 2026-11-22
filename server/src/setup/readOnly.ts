import type { Mailbox } from "../ports.js";

/** Why: setup may look at mail but must be unable to move, label or draft anything. */
export type ReadOnlyMailbox = Pick<Mailbox, "open" | "scanHeaders" | "readMessage" | "close">;

export function readOnly(mailbox: Mailbox): ReadOnlyMailbox {
  return {
    open: () => mailbox.open(),
    scanHeaders: (uid) => mailbox.scanHeaders(uid),
    readMessage: (id) => mailbox.readMessage(id),
    close: () => mailbox.close(),
  };
}
