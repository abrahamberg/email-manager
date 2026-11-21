import { describe, expect, it } from "vitest";
import { queueMoveToInbox } from "../../src/http/queries/receipts";
import { MAX_ATTEMPTS } from "../../src/pipeline/pendingActions";
import { pendingActionRepo } from "../../src/store/pendingActions";
import { useFreshDb } from "./freshDb";

describe("pending mailbox actions", () => {
  const db = useFreshDb();
  const repo = () => pendingActionRepo(db());
  const reset = () => db().exec("DELETE FROM pending_mailbox_actions");

  it("queues a move back only for outcomes that moved the message, with its source folder", async () => {
    await reset();
    await queueMoveToInbox(db(), { messageId: "<j@x>", uid: 1, outcome: "junk" });
    await queueMoveToInbox(db(), { messageId: "<d@x>", uid: 2, outcome: "digest" });
    await queueMoveToInbox(db(), { messageId: "<a@x>", uid: 3, outcome: "archived" });
    await queueMoveToInbox(db(), { messageId: "<k@x>", uid: 4, outcome: "labeled" });
    const due = await repo().due();
    expect(due.map((a) => [a.messageId, a.from, a.attempts])).toEqual([["<j@x>", "junk", 0], ["<d@x>", "archive", 0], ["<a@x>", "archive", 0]]);
  });

  it("drops done rows and rows out of attempts, and keeps failures retryable until then", async () => {
    await reset();
    await queueMoveToInbox(db(), { messageId: "<1@x>", uid: 1, outcome: "junk" });
    await queueMoveToInbox(db(), { messageId: "<2@x>", uid: 2, outcome: "junk" });
    const [first, second] = await repo().due();
    await repo().settle(first!.id, { done: true, attempts: 1 });
    await repo().settle(second!.id, { done: false, attempts: MAX_ATTEMPTS - 1, lastError: "timeout" });
    expect((await repo().due()).map((a) => [a.id, a.attempts])).toEqual([[second!.id, MAX_ATTEMPTS - 1]]);
    await repo().settle(second!.id, { done: false, attempts: MAX_ATTEMPTS, lastError: "timeout" });
    expect(await repo().due()).toEqual([]);
    const rows = await db().query<{ done: boolean; last_error: string | null }>(
      "SELECT done_at IS NOT NULL AS done, last_error FROM pending_mailbox_actions ORDER BY id");
    expect(rows).toEqual([{ done: true, last_error: null }, { done: false, last_error: "timeout" }]);
  });

  it("skips rows with an action it does not know", async () => {
    await reset();
    await db().query("INSERT INTO pending_mailbox_actions (message_id, uid, action, from_folder) VALUES ('<z@x>', 1, 'delete', 'junk')");
    expect(await repo().due()).toEqual([]);
  });

  it("rejects an unknown source folder", async () => {
    await expect(db().query(
      "INSERT INTO pending_mailbox_actions (message_id, uid, action, from_folder) VALUES ('<z@x>', 1, 'move_to_inbox', 'sent')")).rejects.toThrow();
  });
});
