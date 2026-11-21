import type { Db } from "./db";
import { init } from "./migrations/001_init";

// SQL lives in TS constants because the server is bundled and reads no files at runtime.
export const migrations: { id: string; sql: string }[] = [{ id: "001_init", sql: init }];

export async function migrate(db: Db, list = migrations): Promise<string[]> {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const done = new Set((await db.query<{ id: string }>("SELECT id FROM schema_migrations")).map((r) => r.id));
  const applied: string[] = [];
  for (const m of list) {
    if (done.has(m.id)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
    });
    applied.push(m.id);
  }
  return applied;
}
