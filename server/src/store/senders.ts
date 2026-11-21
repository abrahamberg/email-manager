import type { SenderHistory, SenderStats } from "../ports";
import type { Db } from "./db";

type Counter = "received" | "replied_to" | "opened";

function bump(db: Db, address: string, counter: Counter): Promise<unknown> {
  // counter is one of three fixed column names, never input.
  return db.query(
    `INSERT INTO senders (address, ${counter}) VALUES ($1, 1)
     ON CONFLICT (address) DO UPDATE SET ${counter} = senders.${counter} + 1, last_seen = now()`,
    [address.toLowerCase()],
  );
}

export function senderRepo(db: Db): SenderHistory & {
  recordReplied(address: string): Promise<void>;
  recordOpened(address: string): Promise<void>;
} {
  return {
    async get(address) {
      const [r] = await db.query<{ address: string; received: number; replied_to: number; opened: number }>(
        "SELECT address, received, replied_to, opened FROM senders WHERE address = $1",
        [address.toLowerCase()],
      );
      return r && ({ address: r.address, received: r.received, repliedTo: r.replied_to, opened: r.opened } satisfies SenderStats);
    },
    async recordReceived(address) {
      await bump(db, address, "received");
    },
    async recordReplied(address) {
      await bump(db, address, "replied_to");
    },
    async recordOpened(address) {
      await bump(db, address, "opened");
    },
  };
}
