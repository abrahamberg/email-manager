import { z } from "zod";
import { decrypt, encrypt } from "./crypto.js";

/** Why: the store keeps only ciphertext; it never sees a refresh token. Bound to one mailbox. */
export interface TokenStore {
  load(): Promise<string | undefined>;
  save(blob: string, expiresAt: string): Promise<void>;
}

const grantSchema = z.object({ user: z.string().min(1), refreshToken: z.string().min(1) });
export type StoredGrant = z.infer<typeof grantSchema>;

export function sealGrant(grant: StoredGrant, key: string | Buffer): string {
  return encrypt(JSON.stringify(grant), key);
}

export function openGrant(blob: string, key: string | Buffer): StoredGrant {
  return grantSchema.parse(JSON.parse(decrypt(blob, key)));
}
