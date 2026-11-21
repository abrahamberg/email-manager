import type { Category } from "@email-manager/shared";
import type { Db } from "../../store/db";
import { ensureTables } from "./tables";

const exists = async (db: Db, sql: string, params: unknown[]) => (await db.query(sql, params)).length > 0;

export const factExists = (db: Db, id: string) => exists(db, "SELECT 1 FROM facts WHERE id = $1", [id]);

export const pickExists = (db: Db, streamId: string, itemId: string) =>
  exists(db, "SELECT 1 FROM stream_items WHERE id = $1 AND stream_id = $2", [itemId, streamId]);

export async function forgetFact(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query("DELETE FROM embeddings WHERE owner_kind = 'fact' AND owner_id = $1", [id]);
    await tx.query("DELETE FROM facts WHERE id = $1", [id]);
  });
}

export function digestGroupExists(db: Db, groupId: string): Promise<boolean> {
  return exists(db, "SELECT 1 FROM outcomes o JOIN messages m USING (message_id) WHERE o.outcome = 'digest' AND 'dg-' || m.from_address = $1", [groupId]);
}

export async function setDigestState(db: Db, groupId: string, state: string): Promise<void> {
  await ensureTables(db);
  await db.query(
    "INSERT INTO digest_states (group_id, state) VALUES ($1, $2) ON CONFLICT (group_id) DO UPDATE SET state = $2", [groupId, state]);
}

export async function unsubscribeCategory(db: Db, category: Category): Promise<void> {
  await ensureTables(db);
  await db.query(
    `INSERT INTO digest_states (group_id, state)
     SELECT DISTINCT 'dg-' || m.from_address, 'unsubscribed' FROM outcomes o JOIN messages m USING (message_id)
     WHERE o.outcome = 'digest' AND m.category = $1
     ON CONFLICT (group_id) DO UPDATE SET state = 'unsubscribed'`, [category]);
}
