import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { z } from "zod";
import { Rule } from "./Rule.js";
import { fetchFeed } from "./fetchFeed.js";
import {
  FeedConfig,
  type FeedConfigInput,
  type FeedDeps,
  type FeedVersion,
  type UpdateResult,
  type VerifyResult,
} from "./feedTypes.js";

const FeedRules = z.array(
  z.preprocess((r) => (r && typeof r === "object" ? { ...r, source: "feed" } : r), Rule),
);

export type Proof = { sha256?: string; ed25519PublicKey?: string; signature?: Uint8Array };

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashMatches(actual: string, pinned: string): boolean {
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(pinned.toLowerCase(), "hex"));
}

function signatureValid(bytes: Uint8Array, publicKey: string, signature: Uint8Array): boolean {
  try {
    const raw = Buffer.from(publicKey, "base64");
    if (raw.length !== 32 || signature.length !== 64) return false;
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: raw.toString("base64url") }, format: "jwk" });
    return verify(null, bytes, key, signature);
  } catch {
    return false;
  }
}

function parseRules(bytes: Uint8Array): Rule[] | undefined {
  try {
    const parsed = FeedRules.safeParse(JSON.parse(Buffer.from(bytes).toString("utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function verifyFeed(bytes: Uint8Array, proof: Proof): VerifyResult {
  if (!proof.sha256 && !proof.ed25519PublicKey) return { ok: false, reason: "no hash or key configured" };
  const version = sha256Hex(bytes);
  if (proof.sha256 && !hashMatches(version, proof.sha256)) return { ok: false, reason: "hash mismatch" };
  if (proof.ed25519PublicKey) {
    if (!proof.signature || !signatureValid(bytes, proof.ed25519PublicKey, proof.signature)) {
      return { ok: false, reason: "bad signature" };
    }
  }
  const rules = parseRules(bytes);
  if (!rules) return { ok: false, reason: "schema validation failed" };
  return { ok: true, rules, version };
}

function decodeSignature(bytes: Uint8Array): Uint8Array {
  return bytes.length === 64 ? bytes : Buffer.from(Buffer.from(bytes).toString("utf8").trim(), "base64");
}

async function loadFeed(input: FeedConfigInput, deps: FeedDeps): Promise<VerifyResult> {
  const parsed = FeedConfig.safeParse(input);
  if (!parsed.success) return { ok: false, reason: `invalid config: ${parsed.error.issues[0]?.message}` };
  const config = parsed.data;
  const limits = { allowedHosts: config.allowedHosts, maxBytes: config.maxBytes, ...deps };
  const body = await fetchFeed(config.url, limits);
  if (!body.ok) return body;
  let signature: Uint8Array | undefined;
  if (config.ed25519PublicKey && config.signatureUrl) {
    const sig = await fetchFeed(config.signatureUrl, { ...limits, maxBytes: 1024 });
    if (!sig.ok) return { ok: false, reason: `signature: ${sig.reason}` };
    signature = decodeSignature(sig.bytes);
  }
  return verifyFeed(body.bytes, { ...config, signature });
}

export async function updateFeed(
  config: FeedConfigInput,
  previous: FeedVersion | undefined,
  deps: FeedDeps = {},
): Promise<UpdateResult> {
  const result = await loadFeed(config, deps);
  if (result.ok) return { rules: result.rules, version: result.version, updated: result.version !== previous?.version };
  return { rules: previous?.rules ?? [], version: previous?.version ?? "", updated: false, reason: result.reason };
}
