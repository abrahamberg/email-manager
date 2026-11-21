import type { Mailbox } from "../ports";

export const MAX_ATTEMPTS = 5;

/** A panel action (undo) queued for the next run; only moves back to INBOX exist so far. */
export interface PendingAction {
  id: number;
  messageId: string;
  action: "move_to_inbox";
  from: "junk" | "archive";
  attempts: number;
}

export interface Settlement {
  done: boolean;
  attempts: number;
  lastError?: string;
}

export interface PendingActionQueue {
  /** Not done and still under MAX_ATTEMPTS, oldest first. */
  due(): Promise<PendingAction[]>;
  settle(id: number, s: Settlement): Promise<void>;
}

type Result = { kind: "moved" } | { kind: "notFound" } | { kind: "failed"; error: string };

/** Not found counts as done: the user may have moved it already, and retrying won't make it appear. */
export function settlementFor(action: PendingAction, result: Result): Settlement {
  if (result.kind === "moved") return { done: true, attempts: action.attempts + 1 };
  if (result.kind === "notFound") return { done: true, attempts: action.attempts + 1, lastError: `not found in ${action.from}` };
  return { done: false, attempts: action.attempts + 1, lastError: result.error };
}

/** Returns one error line per failed action, naming the row and never the message. */
export async function runPendingActions(queue: PendingActionQueue, mailbox: Mailbox): Promise<string[]> {
  const errors: string[] = [];
  for (const action of await queue.due()) {
    const result = await execute(action, mailbox);
    if (result.kind === "failed") errors.push(`pending action ${action.id}: ${result.error}`);
    await queue.settle(action.id, settlementFor(action, result));
  }
  return errors;
}

async function execute(action: PendingAction, mailbox: Mailbox): Promise<Result> {
  try {
    return (await mailbox.moveToInbox(action.messageId, action.from)) ? { kind: "moved" } : { kind: "notFound" };
  } catch (err) {
    return { kind: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
  }
}
