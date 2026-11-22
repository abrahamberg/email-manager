import { describe, expect, it } from "vitest";
import { migrate, migrations } from "../../src/store/migrate";
import { pgliteDb } from "../../src/store/pgliteDb";
import { useFreshDb } from "./freshDb";

const PANEL_TABLES = ["digest_states", "pending_mailbox_actions", "receipt_marks"];

const tablesIn = async (db: ReturnType<typeof pgliteDb>) =>
  (await db.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE tablename = ANY($1) ORDER BY tablename", [PANEL_TABLES])).map((r) => r.tablename);

// Each of the two tests below builds its own PGlite and migrates it, which is slow beside a busy suite.
const OWN_DB_TIMEOUT = 30_000;

describe("003_panel_marks", () => {
  const db = useFreshDb();

  it("creates the panel tables", async () => {
    expect(await tablesIn(db())).toEqual(PANEL_TABLES);
  });

  it("applies over tables an earlier build created lazily", async () => {
    const old = pgliteDb();
    try {
      await migrate(old, migrations.slice(0, 2));
      await old.exec("CREATE TABLE receipt_marks (receipt_id text PRIMARY KEY, undone boolean NOT NULL DEFAULT false, taught text, at timestamptz NOT NULL DEFAULT now())");
      await old.query("INSERT INTO receipt_marks (receipt_id, undone) VALUES ('rc-a-junk', true)");
      expect(await migrate(old, migrations.slice(0, 3))).toEqual(["003_panel_marks"]);
      expect(await old.query("SELECT 1 FROM receipt_marks WHERE receipt_id = 'rc-a-junk'")).toHaveLength(1);
      expect(await tablesIn(old)).toEqual(PANEL_TABLES);
    } finally {
      await old.close();
    }
  }, OWN_DB_TIMEOUT);

  it("backfills the source folder of actions queued before it existed", async () => {
    const old = pgliteDb();
    try {
      await migrate(old, migrations.slice(0, 2));
      await old.exec(`CREATE TABLE pending_mailbox_actions (id bigserial PRIMARY KEY, message_id text NOT NULL, uid bigint NOT NULL,
        action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), done_at timestamptz)`);
      await old.exec(`INSERT INTO outcomes (message_id, uid, outcome, signal, reason, dry_run, at) VALUES
        ('<j@x>', 1, 'junk', 'spam', 'r', false, now()), ('<d@x>', 2, 'digest', 'rule', 'r', false, now())`);
      await old.exec("INSERT INTO pending_mailbox_actions (message_id, uid, action) VALUES ('<j@x>', 1, 'move_to_inbox'), ('<d@x>', 2, 'move_to_inbox')");
      await migrate(old, migrations.slice(0, 3));
      const rows = await old.query("SELECT message_id, from_folder, attempts FROM pending_mailbox_actions ORDER BY id");
      expect(rows).toEqual([
        { message_id: "<j@x>", from_folder: "junk", attempts: 0 },
        { message_id: "<d@x>", from_folder: "archive", attempts: 0 },
      ]);
    } finally {
      await old.close();
    }
  }, OWN_DB_TIMEOUT);
});
