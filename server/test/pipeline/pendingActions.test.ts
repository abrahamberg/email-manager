import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS, runPendingActions, settlementFor, type PendingAction, type PendingActionQueue, type Settlement,
} from "../../src/pipeline/pendingActions";
import { runMailbox } from "../../src/pipeline/runMailbox";
import { fakeMailbox, fixture, runDeps } from "./fakes";

const action = (id: number, over: Partial<PendingAction> = {}): PendingAction =>
  ({ id, messageId: `<m${id}@x>`, action: "move_to_inbox", from: "junk", attempts: 0, ...over });

function fakeQueue(actions: PendingAction[]) {
  const settled: [number, Settlement][] = [];
  const queue: PendingActionQueue = {
    due: async () => actions,
    settle: async (id, s) => void settled.push([id, s]),
  };
  return { queue, settled };
}

describe("settlementFor", () => {
  it.each([
    ["moved", { kind: "moved" } as const, { done: true, attempts: 3 }],
    ["not found", { kind: "notFound" } as const, { done: true, attempts: 3, lastError: "not found in archive" }],
    ["failed", { kind: "failed", error: "timeout" } as const, { done: false, attempts: 3, lastError: "timeout" }],
  ])("%s", (_, result, expected) => {
    expect(settlementFor(action(1, { attempts: 2, from: "archive" }), result)).toEqual(expected);
  });
});

describe("runPendingActions", () => {
  it("moves each message back and settles every row, reporting failures without the message", async () => {
    const box = fakeMailbox({ uidValidity: 1, uidNext: 1 }, []);
    box.mailbox.moveToInbox = async (id, from) => {
      if (id === "<m2@x>") return false;
      if (id === "<m3@x>") throw new Error("connection lost");
      box.calls.push(`move ${id} from ${from}`);
      return true;
    };
    const { queue, settled } = fakeQueue([action(1), action(2, { from: "archive" }), action(3, { attempts: MAX_ATTEMPTS - 1 })]);
    const errors = await runPendingActions(queue, box.mailbox);
    expect(box.calls).toEqual(["move <m1@x> from junk"]);
    expect(errors).toEqual(["pending action 3: connection lost"]);
    expect(settled).toEqual([
      [1, { done: true, attempts: 1 }],
      [2, { done: true, attempts: 1, lastError: "not found in archive" }],
      [3, { done: false, attempts: MAX_ATTEMPTS, lastError: "connection lost" }],
    ]);
  });
});

describe("runMailbox with pending actions", () => {
  const mail = () => [{ uid: 5, source: fixture("receipt.eml") }];

  it("carries them out after prepare and before new mail is read", async () => {
    const order: string[] = [];
    const box = fakeMailbox({ uidValidity: 1, uidNext: 6 }, mail());
    const { queue, settled } = fakeQueue([action(1)]);
    queue.due = async () => (order.push("due"), [action(1)]);
    const open = box.mailbox.open;
    box.mailbox.open = async () => (order.push("open"), open());
    const { deps, records } = runDeps({ mailbox: box.mailbox, pendingActions: queue, prepare: async () => void order.push("migrate") });
    await runMailbox(deps);
    expect(order).toEqual(["migrate", "due", "open"]);
    expect(box.calls).toContain("move <m1@x> from junk to inbox");
    expect(settled).toHaveLength(1);
    expect(records).toHaveLength(1);
  });

  it("leaves them pending in dry-run", async () => {
    const box = fakeMailbox({ uidValidity: 1, uidNext: 6 }, mail());
    const { queue, settled } = fakeQueue([action(1)]);
    const { deps } = runDeps({ mailbox: box.mailbox, pendingActions: queue, dryRun: true });
    await runMailbox(deps);
    expect(box.changes()).toEqual([]);
    expect(settled).toEqual([]);
  });

  it("still reads new mail when the queue fails, and records the error on the run", async () => {
    const box = fakeMailbox({ uidValidity: 1, uidNext: 6 }, mail());
    const queue: PendingActionQueue = { due: async () => { throw new Error("db down"); }, settle: async () => {} };
    const { deps, records } = runDeps({ mailbox: box.mailbox, pendingActions: queue });
    const result = await runMailbox(deps);
    expect(records).toHaveLength(1);
    expect(result?.aborted).toBe(false);
    expect(result?.run.error).toBe("pending actions: db down");
  });
});
