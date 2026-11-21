import type { Db } from "../../store/db";

const ready = new WeakMap<Db, Promise<void>>();

// Panel-side marks that have no home in the pipeline tables yet. Created on
// first use so the store migrations stay untouched.
const DDL = `
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
);`;

export function ensureTables(db: Db): Promise<void> {
  let p = ready.get(db);
  if (!p) {
    p = db.exec(DDL);
    p.catch(() => ready.delete(db));
    ready.set(db, p);
  }
  return p;
}
