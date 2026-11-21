import type { Decision } from "@email-manager/shared";
import type { Db } from "./db";
import { json } from "./convert";

export type DecisionStatus = "pending" | "snoozed" | "done" | "dismissed";

/** Pending items for the panel, kept whole as jsonb since the panel reads them as they are. */
export function decisionRepo(db: Db) {
  const byStatus = async (status: DecisionStatus) =>
    (await db.query<{ payload: Decision }>(
      "SELECT payload FROM decisions WHERE status = $1 ORDER BY created_at, id", [status],
    )).map((r) => r.payload);
  return {
    async add(d: Decision) {
      await db.query(
        `INSERT INTO decisions (id, kind, payload) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET kind = $2, payload = $3::jsonb`,
        [d.id, d.kind, json(d)],
      );
    },
    async get(id: string): Promise<Decision | undefined> {
      const [r] = await db.query<{ payload: Decision }>("SELECT payload FROM decisions WHERE id = $1", [id]);
      return r?.payload;
    },
    pending: () => byStatus("pending"),
    snoozed: () => byStatus("snoozed"),
    async snooze(id: string, until: string) {
      await db.query("UPDATE decisions SET status = 'snoozed', snoozed_until = $2 WHERE id = $1", [id, until]);
    },
    /** Brings snoozed items whose time has come back to pending. */
    async wake(now: string): Promise<number> {
      const rows = await db.query(
        "UPDATE decisions SET status = 'pending', snoozed_until = NULL WHERE status = 'snoozed' AND snoozed_until <= $1 RETURNING id",
        [now],
      );
      return rows.length;
    },
    async resolve(id: string, status: "done" | "dismissed", resolution?: string) {
      await db.query(
        "UPDATE decisions SET status = $2, resolution = $3, resolved_at = now() WHERE id = $1",
        [id, status, resolution ?? null],
      );
    },
  };
}
