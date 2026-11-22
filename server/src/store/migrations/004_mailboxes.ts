// Mail providers moved from env to the panel, one row per mailbox. Secrets are sealed before
// they reach these columns. Rows written before this have no mailbox (NULL): runs skip them.
export const mailboxes = `
CREATE TABLE mailboxes (
  id text PRIMARY KEY,
  label text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('imap', 'office365', 'gmail')),
  imap_host text,
  imap_port integer,
  imap_user text,
  smtp_host text,
  smtp_port integer,
  oauth_client_id text,
  oauth_client_secret_enc text,
  imap_password_enc text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mailbox_tokens (
  mailbox_id text PRIMARY KEY REFERENCES mailboxes(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants here were per provider and sealed with an env key that no longer exists.
DROP TABLE IF EXISTS oauth_tokens;

ALTER TABLE outcomes ADD COLUMN mailbox_id text;
ALTER TABLE messages ADD COLUMN mailbox_id text;
ALTER TABLE pending_mailbox_actions ADD COLUMN mailbox_id text;
CREATE INDEX pending_mailbox_actions_mailbox_idx ON pending_mailbox_actions (mailbox_id) WHERE done_at IS NULL;
`;
