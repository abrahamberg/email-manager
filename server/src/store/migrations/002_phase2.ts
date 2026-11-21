export const phase2 = `
ALTER TABLE outcomes ADD COLUMN tier text;

ALTER TABLE matters ADD COLUMN keys text[] NOT NULL DEFAULT '{}';
ALTER TABLE matters ADD COLUMN vector real[];

CREATE TABLE policies (
  category text PRIMARY KEY,
  level text NOT NULL DEFAULT 'suggest',
  correct integer NOT NULL DEFAULT 0,
  checked integer NOT NULL DEFAULT 0
);

CREATE TABLE quick_checks (
  id text PRIMARY KEY,
  outcome_id bigint NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  question text NOT NULL,
  sender text NOT NULL DEFAULT '',
  answered boolean NOT NULL DEFAULT false,
  correct boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  owner text NOT NULL DEFAULT 'me',
  message_id text NOT NULL,
  due text,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE briefings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_at timestamptz NOT NULL
);
`;
