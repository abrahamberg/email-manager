import type { Db } from "./db";
import { isoOrUndef } from "./convert";

/** Encryption happens before this repo; it only ever sees ciphertext. */
export interface StoredToken {
  ciphertext: string;
  expiresAt?: string;
}

/** One OAuth grant per mailbox; removing the mailbox removes its grant. */
export function tokenRepo(db: Db) {
  return {
    async save(mailboxId: string, t: StoredToken) {
      await db.query(
        `INSERT INTO mailbox_tokens (mailbox_id, ciphertext, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (mailbox_id) DO UPDATE SET ciphertext = $2, expires_at = $3, updated_at = now()`,
        [mailboxId, t.ciphertext, t.expiresAt ?? null],
      );
    },
    async get(mailboxId: string): Promise<StoredToken | undefined> {
      const [r] = await db.query<{ ciphertext: string; expires_at: unknown }>(
        "SELECT ciphertext, expires_at FROM mailbox_tokens WHERE mailbox_id = $1", [mailboxId]);
      return r && { ciphertext: r.ciphertext, expiresAt: isoOrUndef(r.expires_at) };
    },
    async remove(mailboxId: string) {
      await db.query("DELETE FROM mailbox_tokens WHERE mailbox_id = $1", [mailboxId]);
    },
  };
}
