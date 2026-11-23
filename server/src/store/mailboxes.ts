import type { Db } from "./db";
import { iso, orUndef } from "./convert";

export type MailProvider = "imap" | "office365" | "gmail";

/** What the panel may see: no secret, only whether one is saved. */
export interface MailboxRecord {
  id: string;
  label: string;
  provider: MailProvider;
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  smtpHost?: string;
  smtpPort?: number;
  oauthClientId?: string;
  /** Office 365 tenant id or domain; undefined means the common endpoint. */
  oauthTenant?: string;
  hasClientSecret: boolean;
  hasPassword: boolean;
  enabled: boolean;
  createdAt: string;
}

/** Ciphertext only: sealing and opening happen outside the store. */
export interface SealedSecrets {
  clientSecret?: string;
  password?: string;
}

export type MailboxWrite = Omit<MailboxRecord, "hasClientSecret" | "hasPassword" | "createdAt">;

interface Row {
  id: string; label: string; provider: MailProvider; imap_host: string | null; imap_port: number | null;
  imap_user: string | null; smtp_host: string | null; smtp_port: number | null; oauth_client_id: string | null; oauth_tenant: string | null;
  oauth_client_secret_enc: string | null; imap_password_enc: string | null; enabled: boolean; created_at: unknown;
}

const toRecord = (r: Row): MailboxRecord => ({
  id: r.id, label: r.label, provider: r.provider, imapHost: orUndef(r.imap_host), imapPort: orUndef(r.imap_port),
  imapUser: orUndef(r.imap_user), smtpHost: orUndef(r.smtp_host), smtpPort: orUndef(r.smtp_port),
  oauthClientId: orUndef(r.oauth_client_id), oauthTenant: orUndef(r.oauth_tenant), hasClientSecret: r.oauth_client_secret_enc !== null,
  hasPassword: r.imap_password_enc !== null, enabled: r.enabled, createdAt: iso(r.created_at),
});

const toSealed = (r: Row): SealedSecrets => ({
  clientSecret: orUndef(r.oauth_client_secret_enc), password: orUndef(r.imap_password_enc),
});

export function mailboxRepo(db: Db) {
  const rows = (where = "", params: unknown[] = []) =>
    db.query<Row>(`SELECT * FROM mailboxes ${where} ORDER BY created_at, id`, params);
  return {
    async list(): Promise<MailboxRecord[]> {
      return (await rows()).map(toRecord);
    },
    async get(id: string): Promise<MailboxRecord | undefined> {
      const [r] = await rows("WHERE id = $1", [id]);
      return r && toRecord(r);
    },
    /** For wiring only, never for a response. */
    async withSecrets(id: string): Promise<{ mailbox: MailboxRecord; sealed: SealedSecrets } | undefined> {
      const [r] = await rows("WHERE id = $1", [id]);
      return r && { mailbox: toRecord(r), sealed: toSealed(r) };
    },
    async enabledWithSecrets(): Promise<{ mailbox: MailboxRecord; sealed: SealedSecrets }[]> {
      return (await rows("WHERE enabled")).map((r) => ({ mailbox: toRecord(r), sealed: toSealed(r) }));
    },
    /** A secret left undefined keeps the one already saved. */
    async save(m: MailboxWrite, sealed: SealedSecrets) {
      await db.query(
        `INSERT INTO mailboxes (id, label, provider, imap_host, imap_port, imap_user, smtp_host, smtp_port, oauth_client_id,
           oauth_client_secret_enc, imap_password_enc, enabled, oauth_tenant)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET label = $2, provider = $3, imap_host = $4, imap_port = $5, imap_user = $6,
           smtp_host = $7, smtp_port = $8, oauth_client_id = $9,
           oauth_client_secret_enc = COALESCE($10, mailboxes.oauth_client_secret_enc),
           imap_password_enc = COALESCE($11, mailboxes.imap_password_enc), enabled = $12, oauth_tenant = $13`,
        [m.id, m.label, m.provider, m.imapHost ?? null, m.imapPort ?? null, m.imapUser ?? null, m.smtpHost ?? null,
          m.smtpPort ?? null, m.oauthClientId ?? null, sealed.clientSecret ?? null, sealed.password ?? null, m.enabled,
          m.oauthTenant ?? null],
      );
    },
    async remove(id: string) {
      await db.transaction(async (tx) => {
        await tx.query("DELETE FROM mailbox_cursor WHERE mailbox = $1", [id]);
        await tx.query("DELETE FROM pending_mailbox_actions WHERE mailbox_id = $1 AND done_at IS NULL", [id]);
        await tx.query("DELETE FROM mailboxes WHERE id = $1", [id]);
      });
    },
  };
}

export type MailboxRepo = ReturnType<typeof mailboxRepo>;
