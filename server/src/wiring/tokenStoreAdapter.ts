import type { TokenStore } from "../mail/auth/tokenStore";
import type { Store } from "../store";

export function tokenStoreAdapter(tokens: Store["tokens"], mailboxId: string): TokenStore {
  return {
    load: async () => (await tokens.get(mailboxId))?.ciphertext,
    save: (blob, expiresAt) => tokens.save(mailboxId, { ciphertext: blob, expiresAt }),
  };
}
