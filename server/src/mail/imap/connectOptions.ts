import type { MailCredentials } from "../../ports.js";
import type { ImapMailboxOptions } from "../imapMailbox.js";

// Why: without doSTARTTLS a man in the middle can strip the STARTTLS offer and read the password.
export function transport(o: ImapMailboxOptions) {
  return {
    host: o.host, port: o.port, secure: o.secure,
    ...(o.servername && { servername: o.servername }),
    ...(!o.secure && !o.allowPlaintext && { doSTARTTLS: true }),
  };
}

export function toAuth(creds: MailCredentials) {
  return creds.kind === "password"
    ? { user: creds.user, pass: creds.password }
    : { user: creds.user, accessToken: creds.accessToken };
}
