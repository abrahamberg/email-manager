import type { MailboxInput, MailboxView, MailProvider, SetupTarget } from "../../api/setupApi";

export interface MailboxForm {
  provider: MailProvider;
  label: string;
  host: string;
  port: number;
  user: string;
  password: string;
  smtpHost: string;
  smtpPort: number | undefined;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

export const emptyForm = (provider: MailProvider = "office365"): MailboxForm => ({
  provider, label: "", host: "", port: 993, user: "", password: "", smtpHost: "", smtpPort: undefined,
  clientId: "", clientSecret: "", enabled: true,
});

/** Secrets start empty: the server never sends them back, and empty keeps the saved one. */
export function formFrom(m: MailboxView): MailboxForm {
  return {
    ...emptyForm(m.provider), label: m.label, host: m.imapHost ?? "", port: m.imapPort ?? 993, user: m.imapUser ?? "",
    smtpHost: m.smtpHost ?? "", smtpPort: m.smtpPort, clientId: m.oauthClientId ?? "", enabled: m.enabled,
  };
}

export const CHOICES: { id: MailProvider; label: string; hint: string }[] = [
  { id: "office365", label: "Office 365", hint: "Sign in with Microsoft, using your app registration" },
  { id: "gmail", label: "Gmail", hint: "Sign in with Google, using your OAuth client" },
  { id: "imap", label: "Another server", hint: "IMAP and SMTP with host, port, user and password" },
];

const optional = (v: string) => (v ? v : undefined);

/** The body to save, or undefined while a required field is empty. A blank secret is left out. */
export function inputFor(f: MailboxForm): MailboxInput | undefined {
  const label = f.label.trim();
  if (!label) return undefined;
  if (f.provider !== "imap") {
    const clientId = f.clientId.trim();
    return clientId ? { provider: f.provider, label, clientId, clientSecret: optional(f.clientSecret), enabled: f.enabled } : undefined;
  }
  const host = f.host.trim();
  const user = f.user.trim();
  if (!host || !user || !Number.isInteger(f.port) || f.port <= 0) return undefined;
  const smtpHost = optional(f.smtpHost.trim());
  return {
    provider: "imap", label, host, port: f.port, user, password: optional(f.password),
    ...(smtpHost ? { smtpHost, smtpPort: f.smtpPort ?? 587 } : {}), enabled: f.enabled,
  };
}

/** An IMAP login can be tried before it is saved; anything else is tested once saved. */
export function unsavedTarget(f: MailboxForm): SetupTarget | undefined {
  const input = inputFor(f);
  if (input?.provider !== "imap" || !input.password) return undefined;
  return { provider: "imap", host: input.host, port: input.port, user: input.user, password: input.password };
}
