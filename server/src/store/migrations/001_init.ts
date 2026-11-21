// Bodies are never stored: messages keep headers and compact text only.
export const init = `
CREATE TABLE mailbox_cursor (
  mailbox text PRIMARY KEY,
  uid_validity bigint NOT NULL,
  uid_next bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE areas (
  id text PRIMARY KEY,
  short_name text NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  note text,
  people jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE messages (
  message_id text PRIMARY KEY,
  uid bigint NOT NULL,
  thread_id text,
  from_address text NOT NULL,
  from_name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL,
  category text,
  area_id text REFERENCES areas(id) ON DELETE SET NULL,
  compact_text text NOT NULL DEFAULT ''
);
CREATE INDEX messages_received_idx ON messages (received_at DESC);

CREATE TABLE outcomes (
  id bigserial PRIMARY KEY,
  message_id text NOT NULL,
  uid bigint NOT NULL,
  outcome text NOT NULL,
  signal text NOT NULL,
  reason text NOT NULL,
  confidence double precision,
  area_id text,
  dry_run boolean NOT NULL,
  at timestamptz NOT NULL
);
CREATE INDEX outcomes_message_idx ON outcomes (message_id);

CREATE TABLE rule_versions (
  feed_id text NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  host text NOT NULL,
  verified boolean NOT NULL,
  rule_count integer NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_id, version)
);

CREATE TABLE rules (
  id text PRIMARY KEY,
  source text NOT NULL,
  status text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  text text NOT NULL DEFAULT '',
  feed_id text,
  definition jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 0
);

CREATE TABLE senders (
  address text PRIMARY KEY,
  received integer NOT NULL DEFAULT 0,
  replied_to integer NOT NULL DEFAULT 0,
  opened integer NOT NULL DEFAULT 0,
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE runs (
  id text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  duration_sec double precision NOT NULL DEFAULT 0,
  fetched integer NOT NULL DEFAULT 0,
  handled_by_logic integer NOT NULL DEFAULT 0,
  sent_to_ai integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  cost_usd double precision NOT NULL DEFAULT 0,
  error text
);

CREATE TABLE facts (
  id text PRIMARY KEY,
  area_id text NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  at timestamptz,
  place text,
  source_email_id text
);

CREATE TABLE matters (
  id text PRIMARY KEY,
  area_id text REFERENCES areas(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matter_messages (
  matter_id text NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  PRIMARY KEY (matter_id, message_id)
);

CREATE TABLE streams (
  id text PRIMARY KEY,
  name text NOT NULL,
  area_id text NOT NULL,
  email_id text NOT NULL,
  period text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  rest text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stream_items (
  id text PRIMARY KEY,
  stream_id text NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  position integer NOT NULL,
  title text NOT NULL,
  facts jsonb NOT NULL DEFAULT '[]',
  why text NOT NULL DEFAULT '',
  closes text,
  feedback text
);

CREATE TABLE decisions (
  id text PRIMARY KEY,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text
);

CREATE TABLE embeddings (
  owner_kind text NOT NULL,
  owner_id text NOT NULL,
  vector real[] NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_kind, owner_id)
);

CREATE TABLE oauth_tokens (
  provider text PRIMARY KEY,
  ciphertext text NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  value jsonb NOT NULL
);
`;
