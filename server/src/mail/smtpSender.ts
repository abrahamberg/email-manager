import nodemailer from "nodemailer";
import type { MailAuth, MailCredentials, OutgoingMail, ReplySender } from "../ports";

export interface SmtpTransport {
  sendMail(message: Record<string, unknown>): Promise<unknown>;
}
export type SmtpTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth?: Record<string, string>;
};

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  auth: MailAuth;
  enabled: boolean;
  transportFactory?: (options: SmtpTransportOptions) => SmtpTransport;
}

const MAX_RECIPIENTS = 10;
const PLAIN_ADDRESS = /^[^\s<>()[\]\\,;:"@]+@[^\s<>()[\]\\,;:"@]+\.[^\s<>()[\]\\,;:"@]+$/;
const hasLineBreak = (s: string) => /[\r\n]/.test(s);

function validate(mail: OutgoingMail): void {
  if (mail.to.length === 0 || mail.to.length > MAX_RECIPIENTS) {
    throw new Error(`Recipients must be 1 to ${MAX_RECIPIENTS}`);
  }
  for (const a of mail.to) {
    if (hasLineBreak(a) || !PLAIN_ADDRESS.test(a)) throw new Error("Invalid recipient address");
  }
  if (hasLineBreak(mail.subject)) throw new Error("Invalid subject");
  const ids = [...(mail.inReplyTo ? [mail.inReplyTo] : []), ...(mail.references ?? [])];
  if (ids.some(hasLineBreak)) throw new Error("Invalid threading header");
}

function toSmtpAuth(c: MailCredentials): Record<string, string> {
  return c.kind === "password"
    ? { user: c.user, pass: c.password }
    : { type: "OAuth2", user: c.user, accessToken: c.accessToken };
}

const defaultFactory = (o: SmtpTransportOptions): SmtpTransport =>
  nodemailer.createTransport(o) as unknown as SmtpTransport;

export function smtpSender(config: SmtpConfig): ReplySender {
  const { enabled, transportFactory = defaultFactory } = config;
  return {
    async send(mail) {
      if (!enabled) throw new Error("Sending is disabled: v1 saves drafts only");
      validate(mail);
      const auth = toSmtpAuth(await config.auth.credentials());
      const transport = transportFactory({ host: config.host, port: config.port, secure: config.secure, auth });
      await transport.sendMail({
        from: config.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        ...(mail.inReplyTo && { inReplyTo: mail.inReplyTo }),
        ...(mail.references?.length && { references: mail.references }),
      });
    },
  };
}
