import { z } from "zod";
import { IMAP_TLS_PORT, isPublicHost } from "../setup/target";

const host = z.string().trim().min(1).max(253).refine(isPublicHost, "host not allowed");
const label = z.string().trim().min(1).max(80);
/** A tenant GUID or domain: it becomes a path segment of the Microsoft sign-in URL. */
const tenant = z.string().trim().regex(/^[A-Za-z0-9.-]{1,253}$/, "tenant id or domain");

export const SMTP_PORTS = [465, 587] as const;

export const ImapInput = z.object({
  provider: z.literal("imap"),
  label,
  host,
  port: z.literal(IMAP_TLS_PORT),
  user: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(512).optional(),
  smtpHost: host.optional(),
  smtpPort: z.union([z.literal(SMTP_PORTS[0]), z.literal(SMTP_PORTS[1])]).optional(),
  enabled: z.boolean().default(true),
}).strict();

const oauthFields = {
  label,
  clientId: z.string().trim().min(1).max(512),
  clientSecret: z.string().min(1).max(1024).optional(),
  enabled: z.boolean().default(true),
};

export const Office365Input = z.object({ provider: z.literal("office365"), ...oauthFields, tenant: tenant.optional() }).strict();
export const GmailInput = z.object({ provider: z.literal("gmail"), ...oauthFields }).strict();

/** What the panel sends to add or edit a mailbox. Secrets are write-only and may be left out on edit. */
export const MailboxInput = z.discriminatedUnion("provider", [ImapInput, Office365Input, GmailInput]);
export type MailboxInput = z.infer<typeof MailboxInput>;
