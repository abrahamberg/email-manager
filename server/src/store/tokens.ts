import type { Db } from "./db";
import { isoOrUndef } from "./convert";

export type TokenProvider = "office365" | "gmail";

/** Encryption happens before this repo; it only ever sees ciphertext. */
export interface StoredToken {
  ciphertext: string;
  expiresAt?: string;
}

export function tokenRepo(db: Db) {
  return {
    async save(provider: TokenProvider, t: StoredToken) {
      await db.query(
        `INSERT INTO oauth_tokens (provider, ciphertext, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (provider) DO UPDATE SET ciphertext = $2, expires_at = $3, updated_at = now()`,
        [provider, t.ciphertext, t.expiresAt ?? null],
      );
    },
    async get(provider: TokenProvider): Promise<StoredToken | undefined> {
      const [r] = await db.query<{ ciphertext: string; expires_at: unknown }>(
        "SELECT ciphertext, expires_at FROM oauth_tokens WHERE provider = $1", [provider]);
      return r && { ciphertext: r.ciphertext, expiresAt: isoOrUndef(r.expires_at) };
    },
    async remove(provider: TokenProvider) {
      await db.query("DELETE FROM oauth_tokens WHERE provider = $1", [provider]);
    },
  };
}
