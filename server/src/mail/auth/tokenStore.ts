import { z } from "zod";
import { decrypt, encrypt } from "./crypto.js";
import type { OAuthProviderId } from "./providers.js";

/** Why: the store keeps only ciphertext; it never sees a refresh token. */
export interface TokenStore {
  load(provider: OAuthProviderId): Promise<string | undefined>;
  save(provider: OAuthProviderId, blob: string, expiresAt: string): Promise<void>;
}

const grantSchema = z.object({ user: z.string().min(1), refreshToken: z.string().min(1) });
export type StoredGrant = z.infer<typeof grantSchema>;

export function sealGrant(grant: StoredGrant, key: string | Buffer): string {
  return encrypt(JSON.stringify(grant), key);
}

export function openGrant(blob: string, key: string | Buffer): StoredGrant {
  return grantSchema.parse(JSON.parse(decrypt(blob, key)));
}
