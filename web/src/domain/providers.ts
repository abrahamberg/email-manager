import type { MailProvider } from "../api/setupApi";

const KNOWN_HOSTS: [RegExp, MailProvider][] = [
  [/(^|\.)(gmail|googlemail)\.com$/, "gmail"],
  [/(^|\.)(office365|outlook)\.com$/, "office365"],
];

/** Which provider an IMAP host belongs to, so a plain host still shows the right logo. */
export function providerFromHost(host: string): MailProvider {
  const name = host.trim().toLowerCase();
  return KNOWN_HOSTS.find(([pattern]) => pattern.test(name))?.[1] ?? "imap";
}
