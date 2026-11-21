import { afterAll, beforeAll } from "vitest";
import type { Db } from "../../src/store/db";
import { migrate } from "../../src/store/migrate";
import { pgliteDb } from "../../src/store/pgliteDb";

/** A migrated in-process database per test file. */
export function useFreshDb(): () => Db {
  let db: Db;
  beforeAll(async () => {
    db = pgliteDb();
    await migrate(db);
  });
  afterAll(() => db.close());
  return () => db;
}
