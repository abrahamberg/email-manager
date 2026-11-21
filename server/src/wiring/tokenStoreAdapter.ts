import type { TokenStore } from "../mail/auth/tokenStore";
import type { Store } from "../store";

export function tokenStoreAdapter(tokens: Store["tokens"]): TokenStore {
  return {
    load: async (provider) => (await tokens.get(provider))?.ciphertext,
    save: (provider, blob, expiresAt) => tokens.save(provider, { ciphertext: blob, expiresAt }),
  };
}
