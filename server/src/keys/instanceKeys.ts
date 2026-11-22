import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { readOrCreate, requireDir } from "./createOnce";

export interface InstanceKeys {
  /** AES-256-GCM key for refresh tokens and mailbox secrets. */
  encryptionKey: Buffer;
  /** Bearer token for the internal run port. */
  internalToken: string;
}

export interface KeySource {
  DATA_DIR: string;
  TOKEN_ENCRYPTION_KEY?: string;
  INTERNAL_TOKEN?: string;
}

export const KEY_FILE = "token-encryption-key";
export const TOKEN_FILE = "internal-token";
const MIN_TOKEN = 32;

export function parseKey(text: string): Buffer | undefined {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return undefined;
  const key = Buffer.from(text, "base64");
  return key.length === 32 ? key : undefined;
}

export const parseToken = (text: string) => (text.length >= MIN_TOKEN && !/\s/.test(text) ? text : undefined);

/** Env values win when set (config validated them); otherwise both live on the shared data volume. */
export async function loadInstanceKeys(src: KeySource): Promise<InstanceKeys> {
  const needFiles = !src.TOKEN_ENCRYPTION_KEY || !src.INTERNAL_TOKEN;
  if (needFiles) await requireDir(src.DATA_DIR);
  const encryptionKey = src.TOKEN_ENCRYPTION_KEY
    ? Buffer.from(src.TOKEN_ENCRYPTION_KEY, "base64")
    : await readOrCreate(join(src.DATA_DIR, KEY_FILE), () => randomBytes(32).toString("base64"), parseKey);
  const internalToken = src.INTERNAL_TOKEN
    ?? await readOrCreate(join(src.DATA_DIR, TOKEN_FILE), () => randomBytes(32).toString("base64url"), parseToken);
  return { encryptionKey, internalToken };
}
