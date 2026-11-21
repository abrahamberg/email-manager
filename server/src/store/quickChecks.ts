import type { QuickCheck } from "@email-manager/shared";
import type { Db } from "./db";

export interface NewQuickCheck { id: string; messageId: string; question: string; sender?: string }

/** One quick question about a handled email; it points at the latest outcome for that message. */
export function quickCheckRepo(db: Db) {
  return {
    /** False when the message has no outcome to ask about. */
    async create(q: NewQuickCheck): Promise<boolean> {
      const rows = await db.query(
        `INSERT INTO quick_checks (id, outcome_id, question, sender)
         SELECT $1, o.id, $3, $4 FROM outcomes o WHERE o.message_id = $2 ORDER BY o.at DESC, o.id DESC LIMIT 1
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [q.id, q.messageId, q.question, q.sender ?? ""],
      );
      return rows.length > 0;
    },
    async listOpen(): Promise<QuickCheck[]> {
      const rows = await db.query<{ id: string; message_id: string; outcome: string; question: string }>(
        `SELECT q.id, o.message_id, o.outcome, q.question FROM quick_checks q JOIN outcomes o ON o.id = q.outcome_id
         WHERE NOT q.answered ORDER BY q.created_at, q.id`,
      );
      return rows.map((r) => ({ id: r.id, receiptId: `rc-${r.message_id}-${r.outcome}`, question: r.question }));
    },
    /** The category of the checked message once recorded; undefined for an unknown or already answered check. */
    async answer(id: string, correct: boolean): Promise<{ category?: string } | undefined> {
      const rows = await db.query<{ outcome_id: string | number }>(
        "UPDATE quick_checks SET answered = true, correct = $2 WHERE id = $1 AND NOT answered RETURNING outcome_id",
        [id, correct],
      );
      if (!rows[0]) return undefined;
      const [m] = await db.query<{ category: string | null }>(
        "SELECT m.category FROM outcomes o JOIN messages m USING (message_id) WHERE o.id = $1", [rows[0].outcome_id]);
      return { category: m?.category ?? undefined };
    },
  };
}
