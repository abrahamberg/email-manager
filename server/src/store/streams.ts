import type { Stream, StreamItem } from "@email-manager/shared";
import type { Db } from "./db";
import { json, orUndef } from "./convert";

interface StreamRow { id: string; name: string; area_id: string; email_id: string; period: string; total: number; rest: string }
interface ItemRow { id: string; stream_id: string; title: string; facts: string[]; why: string; closes: string | null; feedback: StreamItem["feedback"] | null }

const toItem = (r: ItemRow): StreamItem => ({
  id: r.id, title: r.title, facts: r.facts, why: r.why, closes: orUndef(r.closes), feedback: orUndef(r.feedback),
});

export function streamRepo(db: Db) {
  async function picksFor(ids: string[]): Promise<Map<string, StreamItem[]>> {
    const rows = await db.query<ItemRow>(
      "SELECT * FROM stream_items WHERE stream_id = ANY($1::text[]) ORDER BY position", [ids]);
    const by = new Map<string, StreamItem[]>();
    for (const r of rows) by.set(r.stream_id, [...(by.get(r.stream_id) ?? []), toItem(r)]);
    return by;
  }
  return {
    /** Replaces the stream and its picks together. */
    async save(s: Stream) {
      await db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO streams (id, name, area_id, email_id, period, total, rest) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET name = $2, area_id = $3, email_id = $4, period = $5, total = $6, rest = $7, updated_at = now()`,
          [s.id, s.name, s.areaId, s.emailId, s.period, s.total, s.rest],
        );
        await tx.query("DELETE FROM stream_items WHERE stream_id = $1", [s.id]);
        for (const [i, p] of s.picks.entries()) {
          await tx.query(
            `INSERT INTO stream_items (id, stream_id, position, title, facts, why, closes, feedback)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
            [p.id, s.id, i, p.title, json(p.facts), p.why, p.closes ?? null, p.feedback ?? null],
          );
        }
      });
    },
    async list(): Promise<Stream[]> {
      const rows = await db.query<StreamRow>("SELECT * FROM streams ORDER BY updated_at DESC, id");
      const picks = await picksFor(rows.map((r) => r.id));
      return rows.map((r) => ({
        id: r.id, name: r.name, areaId: r.area_id, emailId: r.email_id, period: r.period,
        total: r.total, rest: r.rest, picks: picks.get(r.id) ?? [],
      }));
    },
    async setFeedback(itemId: string, feedback: StreamItem["feedback"]) {
      await db.query("UPDATE stream_items SET feedback = $2 WHERE id = $1", [itemId, feedback ?? null]);
    },
  };
}
