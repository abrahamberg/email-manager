import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^198\.1[89]\./, /^(22[4-9]|2[3-5]\d)\./];

// Only global unicast (2000::/3) is public; inside it, documentation and 6to4 can hide private targets.
const GLOBAL_V6 = /^[23][0-9a-f]{3}:/;
const PRIVATE_V6 = [/^2001:db8:/, /^2002:/];

const MAPPED_V4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/;

export function isPublicIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (isIP(v) === 4) return !PRIVATE_V4.some((re) => re.test(v));
  if (isIP(v) !== 6) return false;
  const mapped = MAPPED_V4.exec(v);
  if (mapped) return isPublicIp(mapped[1]!);
  return GLOBAL_V6.test(v) && !PRIVATE_V6.some((re) => re.test(v));
}

export type Lookup = (host: string) => Promise<{ address: string }[]>;

const systemLookup: Lookup = (host) => lookup(host, { all: true, verbatim: true });

/**
 * Why: a public name can resolve to a cluster address, or change between check and connect
 * (DNS rebinding). Every answer must be public, and the caller connects to the address
 * returned here instead of resolving the name again.
 */
export async function resolvePublic(host: string, resolve: Lookup = systemLookup): Promise<string> {
  const answers = await resolve(host);
  if (answers.length === 0 || !answers.every((a) => isPublicIp(a.address))) {
    throw new Error("host does not resolve to a public address");
  }
  return answers[0]!.address;
}
