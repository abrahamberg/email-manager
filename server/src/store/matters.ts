import type { Db } from "./db";
import { iso, orUndef } from "./convert";

/** Many emails about one thing in the user's life. */
export interface Matter {
  id: string;
  areaId?: string;
  title: string;
  summary: string;
  status: "open" | "closed";
  updatedAt: string;
}

interface Row { id: string; area_id: string | null; title: string; summary: string; status: Matter["status"]; updated_at: unknown }

const toMatter = (r: Row): Matter => ({
  id: r.id, areaId: orUndef(r.area_id), title: r.title, summary: r.summary, status: r.status, updatedAt: iso(r.updated_at),
});

export function matterRepo(db: Db) {
  return {
    async save(m: Matter) {
      await db.query(
        `INSERT INTO matters (id, area_id, title, summary, status, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET area_id = $2, title = $3, summary = $4, status = $5, updated_at = $6`,
        [m.id, m.areaId ?? null, m.title, m.summary, m.status, m.updatedAt],
      );
    },
    async get(id: string): Promise<Matter | undefined> {
      const [r] = await db.query<Row>("SELECT * FROM matters WHERE id = $1", [id]);
      return r && toMatter(r);
    },
    async open(): Promise<Matter[]> {
      return (await db.query<Row>("SELECT * FROM matters WHERE status = 'open' ORDER BY updated_at DESC")).map(toMatter);
    },
    async attach(matterId: string, messageId: string) {
      await db.query(
        "INSERT INTO matter_messages (matter_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [matterId, messageId],
      );
    },
    async messageIds(matterId: string): Promise<string[]> {
      const rows = await db.query<{ message_id: string }>(
        "SELECT message_id FROM matter_messages WHERE matter_id = $1 ORDER BY message_id",
        [matterId],
      );
      return rows.map((r) => r.message_id);
    },
    async forMessage(messageId: string): Promise<Matter | undefined> {
      const [r] = await db.query<Row>(
        "SELECT m.* FROM matters m JOIN matter_messages mm ON mm.matter_id = m.id WHERE mm.message_id = $1 LIMIT 1",
        [messageId],
      );
      return r && toMatter(r);
    },
  };
}
