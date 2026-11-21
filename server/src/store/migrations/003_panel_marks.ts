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
`;
