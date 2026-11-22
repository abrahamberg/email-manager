import type { Mailbox } from "../ports";

/** Connects on first use, so a mailbox that cannot be built fails inside its own run step. */
export function lazyMailbox(build: () => Promise<Mailbox>): Mailbox {
  let inner: Promise<Mailbox> | undefined;
  const get = () => (inner ??= build());
  return {
    open: async () => (await get()).open(),
    async *fetchSince(uid) {
      yield* (await get()).fetchSince(uid);
    },
    async *scanHeaders(uid) {
      yield* (await get()).scanHeaders(uid);
    },
    readMessage: async (id) => (await get()).readMessage(id),
    moveTo: async (uid, folder) => (await get()).moveTo(uid, folder),
    moveToInbox: async (id, from) => (await get()).moveToInbox(id, from),
    addLabel: async (uid, label) => (await get()).addLabel(uid, label),
    appendDraft: async (rfc822) => (await get()).appendDraft(rfc822),
    close: async () => {
      if (inner) await (await inner.catch(() => undefined))?.close();
    },
  };
}
