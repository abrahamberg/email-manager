import type { Outcome } from "@email-manager/shared";
import type { Db } from "../../store/db";

export interface ReceiptRef { messageId: string; uid: number; outcome: Outcome }

/** Where each outcome put the message, so undo knows which folder to look in. */
const MOVED_TO: Partial<Record<Outcome, "junk" | "archive">> = { junk: "junk", digest: "archive", archived: "archive" };

/** Receipt ids are `rc-<messageId>-<outcome>`, the same shape the report builds. */
export async function findReceipt(db: Db, id: string): Promise<ReceiptRef | undefined> {
  const m = /^rc-(.+)-([a-z]+)$/.exec(id);
  if (!m) return undefined;
  const [r] = await db.query<{ uid: string | number }>(
    "SELECT uid FROM outcomes WHERE message_id = $1 AND outcome = $2 ORDER BY at DESC, id DESC LIMIT 1", [m[1], m[2]]);
  return r ? { messageId: m[1]!, uid: Number(r.uid), outcome: m[2] as Outcome } : undefined;
}

export async function markUndone(db: Db, id: string, taught?: string): Promise<void> {
  await db.query(
    `INSERT INTO receipt_marks (receipt_id, undone, taught) VALUES ($1, true, $2)
     ON CONFLICT (receipt_id) DO UPDATE SET undone = true, taught = COALESCE($2, receipt_marks.taught)`,
    [id, taught ?? null]);
}

/** Only queues the move; executing it is the next pipeline run's job. */
export async function queueMoveToInbox(db: Db, r: ReceiptRef): Promise<void> {
  const from = MOVED_TO[r.outcome];
  if (!from) return;
  await db.query(
    "INSERT INTO pending_mailbox_actions (message_id, uid, action, from_folder) VALUES ($1, $2, 'move_to_inbox', $3)",
    [r.messageId, r.uid, from]);
}
