// IF NOT EXISTS because earlier builds created these tables lazily on first use.
export const panelMarks = `
CREATE TABLE IF NOT EXISTS receipt_marks (
  receipt_id text PRIMARY KEY,
  undone boolean NOT NULL DEFAULT false,
  taught text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digest_states (
  group_id text PRIMARY KEY,
  state text NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_mailbox_actions (
  id bigserial PRIMARY KEY,
  message_id text NOT NULL,
  uid bigint NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);

-- ADD COLUMN, not CREATE, so a lazily created table gets the columns too.
ALTER TABLE pending_mailbox_actions ADD COLUMN IF NOT EXISTS from_folder text;
ALTER TABLE pending_mailbox_actions ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE pending_mailbox_actions ADD COLUMN IF NOT EXISTS last_error text;
UPDATE pending_mailbox_actions p SET from_folder = CASE
  WHEN (SELECT o.outcome FROM outcomes o WHERE o.message_id = p.message_id ORDER BY o.at DESC, o.id DESC LIMIT 1) = 'junk'
  THEN 'junk' ELSE 'archive' END
WHERE from_folder IS NULL;
ALTER TABLE pending_mailbox_actions ALTER COLUMN from_folder SET NOT NULL;
ALTER TABLE pending_mailbox_actions ADD CONSTRAINT pending_mailbox_actions_from_folder_check
  CHECK (from_folder IN ('junk', 'archive'));
CREATE INDEX IF NOT EXISTS pending_mailbox_actions_due_idx ON pending_mailbox_actions (id) WHERE done_at IS NULL;
`;
