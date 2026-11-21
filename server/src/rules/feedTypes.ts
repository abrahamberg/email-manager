import { z } from "zod";
import type { Rule } from "./Rule.js";

export const FeedConfig = z
  .object({
    id: z.string().min(1),
    url: z.url({ protocol: /^https$/ }),
    allowedHosts: z.array(z.string().min(1)).min(1),
    sha256: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    ed25519PublicKey: z.base64().optional(),
    signatureUrl: z.url({ protocol: /^https$/ }).optional(),
    maxBytes: z.number().int().positive().default(256 * 1024),
  })
  .refine((c) => c.sha256 || c.ed25519PublicKey, "sha256 or ed25519PublicKey is required")
  .refine((c) => !c.ed25519PublicKey || c.signatureUrl, "ed25519PublicKey needs signatureUrl");

export type FeedConfigInput = z.input<typeof FeedConfig>;
export type FeedConfig = z.output<typeof FeedConfig>;

export type Failure = { ok: false; reason: string };
export type FetchResult = { ok: true; bytes: Uint8Array } | Failure;
export type FeedVersion = { rules: Rule[]; version: string };
export type VerifyResult = ({ ok: true } & FeedVersion) | Failure;
export type UpdateResult = FeedVersion & { updated: boolean; reason?: string };

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
export type FeedDeps = { fetch?: FetchFn; timeoutMs?: number };
