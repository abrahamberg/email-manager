import type { Run } from "@email-manager/shared";
import type { Db } from "./db";
import { iso, orUndef } from "./convert";

interface Row {
  id: string; started_at: unknown; duration_sec: number; fetched: number; handled_by_logic: number;
  sent_to_ai: number; tokens: number; cost_usd: number; error: string | null;
}

const toRun = (r: Row): Run => ({
  id: r.id, startedAt: iso(r.started_at), durationSec: r.duration_sec, fetched: r.fetched,
  handledByLogic: r.handled_by_logic, sentToAi: r.sent_to_ai, tokens: r.tokens, costUsd: r.cost_usd,
  error: orUndef(r.error),
});

export function runRepo(db: Db) {
  return {
    async save(run: Run) {
      await db.query(
        `INSERT INTO runs (id, started_at, duration_sec, fetched, handled_by_logic, sent_to_ai, tokens, cost_usd, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET duration_sec = $3, fetched = $4, handled_by_logic = $5,
           sent_to_ai = $6, tokens = $7, cost_usd = $8, error = $9`,
        [run.id, run.startedAt, run.durationSec, run.fetched, run.handledByLogic, run.sentToAi, run.tokens,
          run.costUsd, run.error ?? null],
      );
    },
    async recent(limit: number): Promise<Run[]> {
      return (await db.query<Row>("SELECT * FROM runs ORDER BY started_at DESC LIMIT $1", [limit])).map(toRun);
    },
    /** AI spend since a time, for the daily budget check. */
    async costSince(since: string): Promise<number> {
      const [r] = await db.query<{ total: number | null }>(
        "SELECT sum(cost_usd)::float8 AS total FROM runs WHERE started_at >= $1",
        [since],
      );
      return r?.total ?? 0;
    },
  };
}
