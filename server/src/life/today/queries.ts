import type { Category, Person } from "@email-manager/shared";
import type { Tier } from "../../ports";
import type { TieredOutcome } from "../../store/outcomes";
import type { Db } from "../../store/db";
import { iso } from "../../store/convert";

export interface MessageRow {
  messageId: string;
  from: Person;
  subject: string;
  receivedAt: string;
  category?: Category;
  areaId?: string;
  compactText: string;
}

interface RawMessage {
  message_id: string; from_address: string; from_name: string; subject: string;
  received_at: unknown; category: Category | null; area_id: string | null; compact_text: string;
}

const toMessage = (r: RawMessage): MessageRow => ({
  messageId: r.message_id, from: { name: r.from_name || r.from_address, address: r.from_address },
  subject: r.subject, receivedAt: iso(r.received_at), category: r.category ?? undefined,
  areaId: r.area_id ?? undefined, compactText: r.compact_text,
});

export async function messagesByIds(db: Db, ids: string[]): Promise<Map<string, MessageRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.query<RawMessage>("SELECT * FROM messages WHERE message_id = ANY($1::text[])", [ids]);
  return new Map(rows.map((r) => [r.message_id, toMessage(r)]));
}

interface RawOutcome {
  message_id: string; uid: string | number; outcome: TieredOutcome["outcome"]; signal: TieredOutcome["signal"];
  reason: string; confidence: number | null; area_id: string | null; dry_run: boolean; tier: Tier | null; at: unknown;
}

const toOutcome = (r: RawOutcome): TieredOutcome => ({
  messageId: r.message_id, uid: Number(r.uid), outcome: r.outcome, signal: r.signal, reason: r.reason,
  confidence: r.confidence ?? undefined, areaId: r.area_id ?? undefined, dryRun: r.dry_run, ...(r.tier ? { tier: r.tier } : {}), at: iso(r.at),
});

export async function outcomesSince(db: Db, since: string): Promise<TieredOutcome[]> {
  const rows = await db.query<RawOutcome>("SELECT * FROM outcomes WHERE at >= $1 ORDER BY at DESC, id DESC", [since]);
  return rows.map(toOutcome);
}

export async function outcomesFor(db: Db, ids: string[]): Promise<TieredOutcome[]> {
  if (ids.length === 0) return [];
  const rows = await db.query<RawOutcome>(
    "SELECT * FROM outcomes WHERE message_id = ANY($1::text[]) ORDER BY at, id", [ids]);
  return rows.map(toOutcome);
}

export async function countMessagesSince(db: Db, since: string): Promise<number> {
  const [r] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM messages WHERE received_at >= $1", [since]);
  return r?.n ?? 0;
}

export interface ProfileCounts { emails: number; first: unknown; replied: number; newsletters: number }

export async function profileCounts(db: Db): Promise<ProfileCounts> {
  const [r] = await db.query<ProfileCounts>(
    `SELECT (SELECT count(*)::int FROM messages) AS emails,
            (SELECT min(received_at) FROM messages) AS first,
            (SELECT count(*)::int FROM senders WHERE replied_to > 0) AS replied,
            (SELECT count(DISTINCT m.from_address)::int FROM outcomes o JOIN messages m USING (message_id)
              WHERE o.outcome = 'digest') AS newsletters`);
  return r ?? { emails: 0, first: null, replied: 0, newsletters: 0 };
}

export function outcomeCounts(db: Db): Promise<{ outcome: string; n: number }[]> {
  return db.query("SELECT outcome, count(*)::int AS n FROM outcomes GROUP BY outcome");
}
