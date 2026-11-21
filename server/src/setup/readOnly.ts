import type { Mailbox } from "../ports.js";

/** Why: setup may look at mail but must be unable to move, label or draft anything. */
export type ReadOnlyMailbox = Pick<Mailbox, "open" | "fetchSince" | "close">;

export function readOnly(mailbox: Mailbox): ReadOnlyMailbox {
  return {
    open: () => mailbox.open(),
    fetchSince: (uid) => mailbox.fetchSince(uid),
    close: () => mailbox.close(),
  };
}
