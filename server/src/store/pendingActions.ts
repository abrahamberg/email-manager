import { z } from "zod";
import { MAX_ATTEMPTS, type PendingAction, type PendingActionQueue } from "../pipeline/pendingActions";
import type { Db } from "./db";

// Rows are written by the panel, so read them back strictly; an unknown action is left alone.
const Row = z.object({
  id: z.coerce.number(),
  message_id: z.string().min(1),
  action: z.literal("move_to_inbox"),
  from_folder: z.enum(["junk", "archive"]),
  attempts: z.coerce.number(),
});

const toAction = (r: z.infer<typeof Row>): PendingAction =>
  ({ id: r.id, messageId: r.message_id, action: r.action, from: r.from_folder, attempts: r.attempts });

export function pendingActionRepo(db: Db): PendingActionQueue {
  return {
    async due() {
      const rows = await db.query<unknown>(
        "SELECT id, message_id, action, from_folder, attempts FROM pending_mailbox_actions WHERE done_at IS NULL AND attempts < $1 ORDER BY id",
        [MAX_ATTEMPTS]);
      return rows.flatMap((r) => {
        const parsed = Row.safeParse(r);
        return parsed.success ? [toAction(parsed.data)] : [];
      });
    },
    async settle(id, s) {
      await db.query(
        "UPDATE pending_mailbox_actions SET attempts = $2, last_error = $3, done_at = CASE WHEN $4::boolean THEN now() END WHERE id = $1",
        [id, s.attempts, s.lastError ?? null, s.done]);
    },
  };
}
