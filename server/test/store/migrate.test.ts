import { describe, expect, it } from "vitest";
import { migrate } from "../../src/store/migrate";
import { useFreshDb } from "./freshDb";

describe("migrate", () => {
  const db = useFreshDb();

  it("is idempotent", async () => {
    expect(await migrate(db())).toEqual([]);
  });

  it("rolls back a failing migration", async () => {
    const bad = [{ id: "999_bad", sql: "CREATE TABLE t_ok (x int); SELECT nope FROM missing;" }];
    await expect(migrate(db(), bad)).rejects.toThrow();
    const ids = await db().query<{ id: string }>("SELECT id FROM schema_migrations");
    expect(ids.map((r) => r.id)).toEqual(["001_init", "002_phase2", "003_panel_marks"]);
    expect(await db().query("SELECT 1 FROM pg_tables WHERE tablename = 't_ok'")).toHaveLength(0);
  });

  it("has no body column on messages", async () => {
    const cols = await db().query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'");
    expect(cols.map((c) => c.column_name)).not.toContain("body");
  });
});
