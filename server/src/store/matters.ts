import type { Db } from "./db";
import type { MatterCandidate } from "../life/assignMatter";
import { iso, json, orUndef, pgRealArray } from "./convert";

/** Many emails about one thing in the user's life. */
export interface Matter {
  id: string;
  areaId?: string;
  title: string;
  summary: string;
  status: "open" | "closed";
  updatedAt: string;
  /** Entity keys and embedding used to match new mail; omitted on save keeps what is stored. */
  keys?: string[];
  vector?: number[];
}

interface Row { id: string; area_id: string | null; title: string; summary: string; status: Matter["status"]; updated_at: unknown; keys: string[]; vector: (number | string)[] | null }

const toMatter = (r: Row): Matter => ({
  id: r.id, areaId: orUndef(r.area_id), title: r.title, summary: r.summary, status: r.status, updatedAt: iso(r.updated_at),
  keys: r.keys ?? [], ...(r.vector ? { vector: r.vector.map(Number) } : {}),
});

export function matterRepo(db: Db) {
  return {
    async save(m: Matter) {
      await db.query(
        `INSERT INTO matters (id, area_id, title, summary, status, updated_at, keys, vector)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE(ARRAY(SELECT jsonb_array_elements_text($7::jsonb)), '{}'), $8::real[])
         ON CONFLICT (id) DO UPDATE SET area_id = $2, title = $3, summary = $4, status = $5, updated_at = $6,
           keys = CASE WHEN $7::jsonb IS NULL THEN matters.keys ELSE ARRAY(SELECT jsonb_array_elements_text($7::jsonb)) END,
           vector = COALESCE($8::real[], matters.vector)`,
        [m.id, m.areaId ?? null, m.title, m.summary, m.status, m.updatedAt,
          m.keys ? json(m.keys) : null, m.vector ? pgRealArray(m.vector) : null],
      );
    },
    async get(id: string): Promise<Matter | undefined> {
      const [r] = await db.query<Row>("SELECT * FROM matters WHERE id = $1", [id]);
      return r && toMatter(r);
    },
    async open(): Promise<Matter[]> {
      return (await db.query<Row>("SELECT * FROM matters WHERE status = 'open' ORDER BY updated_at DESC")).map(toMatter);
    },
    /** Open matters with what assignment needs, optionally only those in one area. */
    async openCandidates(areaId?: string): Promise<MatterCandidate[]> {
      const rows = await db.query<Row & { thread_ids: string[] }>(
        `SELECT m.*, COALESCE(array_agg(DISTINCT x.thread_id) FILTER (WHERE x.thread_id IS NOT NULL), '{}') AS thread_ids
         FROM matters m
         LEFT JOIN (SELECT mm.matter_id, msg.thread_id FROM matter_messages mm
                    JOIN messages msg ON msg.message_id = mm.message_id) x ON x.matter_id = m.id
         WHERE m.status = 'open' AND ($1::text IS NULL OR m.area_id = $1)
         GROUP BY m.id ORDER BY m.updated_at DESC, m.id`,
        [areaId ?? null],
      );
      return rows.map((r) => ({
        id: r.id, title: r.title, areaId: orUndef(r.area_id), threadIds: r.thread_ids ?? [],
        keys: r.keys ?? [], ...(r.vector ? { vector: r.vector.map(Number) } : {}),
      }));
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
