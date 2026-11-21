import type { Db } from "./db";
import { isoOrUndef } from "./convert";

/** When the last briefing went out, so "since" in the next one starts there. */
export function briefingRepo(db: Db) {
  return {
    async get(): Promise<string | undefined> {
      const [r] = await db.query<{ last_at: unknown }>("SELECT last_at FROM briefings WHERE id");
      return isoOrUndef(r?.last_at);
    },
    async set(at: string) {
      await db.query(
        "INSERT INTO briefings (id, last_at) VALUES (true, $1) ON CONFLICT (id) DO UPDATE SET last_at = $1", [at]);
    },
  };
}
