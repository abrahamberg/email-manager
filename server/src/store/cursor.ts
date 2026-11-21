import type { MailboxCursor } from "../ports";
import type { Db } from "./db";

export function cursorRepo(db: Db, mailbox = "INBOX"): MailboxCursor {
  return {
    async get() {
      const [row] = await db.query<{ uid_validity: string | number; uid_next: string | number }>(
        "SELECT uid_validity, uid_next FROM mailbox_cursor WHERE mailbox = $1",
        [mailbox],
      );
      return row && { uidValidity: Number(row.uid_validity), uidNext: Number(row.uid_next) };
    },
    async set(state) {
      await db.query(
        `INSERT INTO mailbox_cursor (mailbox, uid_validity, uid_next) VALUES ($1, $2, $3)
         ON CONFLICT (mailbox) DO UPDATE SET uid_validity = $2, uid_next = $3, updated_at = now()`,
        [mailbox, state.uidValidity, state.uidNext],
      );
    },
  };
}
