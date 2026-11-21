import type { ImapDetails, SetupChoice, SetupTarget } from "../../api/setupApi";

export const EMPTY_IMAP: ImapDetails = { host: "", port: 993, user: "", password: "" };

export const CHOICES: { id: SetupChoice; label: string; hint: string }[] = [
  { id: "office365", label: "Office 365", hint: "Sign in with Microsoft" },
  { id: "gmail", label: "Gmail", hint: "Sign in with Google" },
  { id: "imap", label: "Another server", hint: "IMAP and SMTP with host, port, user and password" },
];

/** The target to send to the server, or undefined while the form is incomplete. */
export function targetFor(choice: SetupChoice, imap: ImapDetails): SetupTarget | undefined {
  if (choice !== "imap") return { provider: choice };
  const filled = imap.host.trim() && imap.user.trim() && imap.password && Number.isInteger(imap.port) && imap.port > 0;
  return filled ? { provider: "imap", ...imap, host: imap.host.trim(), user: imap.user.trim() } : undefined;
}
