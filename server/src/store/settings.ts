import type { Settings } from "@email-manager/shared";
import type { Db } from "./db";
import { json } from "./convert";

/** One row: the defaults come from config, the store only keeps what the user saved. */
export function settingsRepo(db: Db) {
  return {
    async get(): Promise<Settings | undefined> {
      const [r] = await db.query<{ value: Settings }>("SELECT value FROM settings WHERE id");
      return r?.value;
    },
    async save(s: Settings) {
      await db.query(
        "INSERT INTO settings (id, value) VALUES (true, $1::jsonb) ON CONFLICT (id) DO UPDATE SET value = $1::jsonb",
        [json(s)],
      );
    },
  };
}
