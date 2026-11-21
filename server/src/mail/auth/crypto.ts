import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

export function toKey(key: string | Buffer): Buffer {
  const buf = typeof key === "string" ? Buffer.from(key, "base64") : key;
  if (buf.length !== 32) throw new Error("Token encryption key must be 32 bytes");
  return buf;
}

/** Output is base64(iv | tag | ciphertext). */
export function encrypt(plain: string, key: string | Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", toKey(key), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(sealed: string, key: string | Buffer): string {
  const raw = Buffer.from(sealed, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) throw new Error("Encrypted token is malformed");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", toKey(key), iv);
  decipher.setAuthTag(tag);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
