import { describe, expect, it } from "vitest";
import { migrate, migrations } from "../../src/store/migrate";
import { pgliteDb } from "../../src/store/pgliteDb";
import { useFreshDb } from "./freshDb";

const PANEL_TABLES = ["digest_states", "pending_mailbox_actions", "receipt_marks"];

const tablesIn = async (db: ReturnType<typeof pgliteDb>) =>
  (await db.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE tablename = ANY($1) ORDER BY tablename", [PANEL_TABLES])).map((r) => r.tablename);

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
      expect(await migrate(old)).toEqual(["003_panel_marks"]);
      expect(await old.query("SELECT 1 FROM receipt_marks WHERE receipt_id = 'rc-a-junk'")).toHaveLength(1);
      expect(await tablesIn(old)).toEqual(PANEL_TABLES);
    } finally {
      await old.close();
    }
  });
});
