import { z } from "zod";

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^(22[4-9]|2[3-5]\d)\./];
const INTERNAL_SUFFIXES = [".local", ".localhost", ".internal", ".svc", ".cluster", ".lan", ".home", ".corp"];

/**
 * Why: the panel lets a user pick the host the server connects to. Refusing private and
 * single-label names keeps that from reaching cluster services. A name that resolves to a
 * private address is not caught here; the deployment's network policy has to cover it.
 */
export function isPublicHost(raw: string): boolean {
  const host = raw.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host) || host.startsWith(".") || host.endsWith(".") || host.includes("..")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !PRIVATE_V4.some((re) => re.test(host));
  const labels = host.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (labels.length < 2 || !/^[a-z][a-z0-9-]*$/.test(tld)) return false;
  return !INTERNAL_SUFFIXES.some((s) => host.endsWith(s));
}

// Why: the adapter uses implicit TLS only on 993, and any other port could send the password in clear.
export const IMAP_TLS_PORT = 993;

export const ImapTarget = z.object({
  provider: z.literal("imap"),
  host: z.string().trim().min(1).max(253).refine(isPublicHost, "host not allowed"),
  port: z.literal(IMAP_TLS_PORT),
  user: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(512),
}).strict();

export const OAuthTarget = z.object({ provider: z.enum(["office365", "gmail"]) }).strict();

export const SetupTarget = z.discriminatedUnion("provider", [ImapTarget, OAuthTarget]);
export type SetupTarget = z.infer<typeof SetupTarget>;
