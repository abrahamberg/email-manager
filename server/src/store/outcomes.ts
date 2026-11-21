import type { OutcomeLog, OutcomeRecord, Tier } from "../ports";
import type { Db } from "./db";
import { iso, orUndef } from "./convert";

/** An outcome with the triage tier that decided it, which the report reads. */
export type TieredOutcome = OutcomeRecord & { tier?: Tier };

interface Row {
  message_id: string;
  uid: string | number;
  outcome: OutcomeRecord["outcome"];
  signal: OutcomeRecord["signal"];
  reason: string;
  confidence: number | null;
  area_id: string | null;
  dry_run: boolean;
  tier: Tier | null;
  at: unknown;
}

export function toRecord(r: Row): TieredOutcome {
  return {
    messageId: r.message_id,
    uid: Number(r.uid),
    outcome: r.outcome,
    signal: r.signal,
    reason: r.reason,
    confidence: orUndef(r.confidence),
    areaId: orUndef(r.area_id),
    dryRun: r.dry_run,
    ...(r.tier ? { tier: r.tier } : {}),
    at: iso(r.at),
  };
}

export function outcomeRepo(db: Db): Omit<OutcomeLog, "record"> & {
  record(o: TieredOutcome): Promise<void>;
  recent(limit: number): Promise<TieredOutcome[]>;
} {
  return {
    async record(o: TieredOutcome) {
      await db.query(
        `INSERT INTO outcomes (message_id, uid, outcome, signal, reason, confidence, area_id, dry_run, tier, at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [o.messageId, o.uid, o.outcome, o.signal, o.reason, o.confidence ?? null, o.areaId ?? null, o.dryRun, o.tier ?? null, o.at],
      );
    },
    async seen(messageId) {
      const rows = await db.query("SELECT 1 FROM outcomes WHERE message_id = $1 LIMIT 1", [messageId]);
      return rows.length > 0;
    },
    async recent(limit) {
      const rows = await db.query<Row>("SELECT * FROM outcomes ORDER BY at DESC, id DESC LIMIT $1", [limit]);
      return rows.map(toRecord);
    },
  };
}
