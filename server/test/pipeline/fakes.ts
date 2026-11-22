import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Run } from "@email-manager/shared";
import type {
  Classifier, Mailbox, MailboxCursor, MailboxState, OutcomeLog, OutcomeRecord, RawMessage, RunLock, SenderHistory,
  SenderStats, SpamCheck, SpamVerdict, Triage,
} from "../../src/ports";
import type { Rule } from "../../src/rules/Rule";
import type { PendingAction, PendingActionQueue, Settlement } from "../../src/pipeline/pendingActions";
import type { MailboxSource, RunDeps } from "../../src/pipeline/runMailbox";

export function fixture(name: string): Uint8Array {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)));
}

export function fakeMailbox(state: MailboxState, messages: RawMessage[]) {
  const calls: string[] = [];
  const fetchedSince: number[] = [];
  const mailbox: Mailbox = {
    open: async () => (calls.push("open"), state),
    async *fetchSince(uid) {
      fetchedSince.push(uid);
      for (const m of messages) if (m.uid > uid) yield m;
    },
    async *scanHeaders() {},
    readMessage: async () => undefined,
    moveTo: async (uid, folder) => void calls.push(`move ${uid} ${folder}`),
    moveToInbox: async (id, from) => (calls.push(`move ${id} from ${from} to inbox`), true),
    addLabel: async (uid, label) => void calls.push(`label ${uid} ${label}`),
    appendDraft: async () => void calls.push("draft"),
    close: async () => void calls.push("close"),
  };
  return { mailbox, calls, fetchedSince, changes: () => calls.filter((c) => /^(move|label|draft)/.test(c)) };
}

export function fakeOutcomes(seenIds: string[] = []) {
  const records: OutcomeRecord[] = [];
  const log: OutcomeLog = {
    record: async (r) => void records.push(r),
    seen: async (id) => seenIds.includes(id) || records.some((r) => r.messageId === id),
  };
  return { log, records };
}

export function fakeSpam(verdict?: SpamVerdict, fail?: Uint8Array): SpamCheck & { calls: number } {
  const check = {
    calls: 0,
    async check(raw: Uint8Array) {
      check.calls++;
      if (fail && raw === fail) throw new Error("spam engine exploded");
      return verdict;
    },
  };
  return check;
}

export function fakeClassifier(): Classifier & { calls: number } {
  const triage: Triage = {
    tier: "worthKnowing", category: "question", needsReply: true, facts: [], confidence: 0.8, why: "A friend asks a question.",
  };
  const c = { calls: 0, triage: async () => (c.calls++, triage) };
  return c;
}

export function fakeCursor(initial?: MailboxState): MailboxCursor & { value?: MailboxState } {
  const c = { value: initial, get: async () => c.value, set: async (s: MailboxState) => void (c.value = s) };
  return c;
}

export function fakeSenders(stats: Record<string, SenderStats> = {}): SenderHistory & { received: string[] } {
  const received: string[] = [];
  return { received, get: async (a) => stats[a], recordReceived: async (a) => void received.push(a) };
}

/** Same contract as the advisory lock: a second holder gets undefined. */
export function fakeLock(): RunLock {
  let held = false;
  return {
    async tryRun(work) {
      if (held) return undefined;
      held = true;
      try {
        return await work();
      } finally {
        held = false;
      }
    },
  };
}

export const clock = { now: () => new Date("2026-06-01T09:00:00Z") };

export function ruleFor(from: string, then: Rule["then"]): Rule {
  return { id: "r1", source: "user", when: [{ field: "from", operator: "contains", value: from }], then, priority: 0, status: "active" };
}

/** One mailbox by default; pass `mailboxes` to run several. */
export interface SingleMailbox {
  mailbox: Mailbox;
  cursor?: MailboxCursor;
  pendingActions?: PendingActionQueue;
}

export function runDeps(over: Partial<RunDeps> & SingleMailbox) {
  const outcomes = fakeOutcomes();
  const runs: Run[] = [];
  const { mailbox, cursor, pendingActions, ...rest } = over;
  const source: MailboxSource = { id: "mb-1", mailbox, cursor: cursor ?? fakeCursor(), pendingActions };
  const deps: RunDeps = {
    lock: fakeLock(),
    mailboxes: async () => [source],
    outcomes: outcomes.log,
    rules: { activeRules: async () => [] },
    senders: fakeSenders(),
    spamCheck: fakeSpam(),
    runs: { save: async (r) => void runs.push(r) },
    clock,
    dryRun: false,
    ...rest,
  };
  return { deps, records: outcomes.records, runs };
}

export function fakeQueue(actions: PendingAction[]) {
  const settled: [number, Settlement][] = [];
  const queue: PendingActionQueue = {
    due: async () => actions,
    settle: async (id, s) => void settled.push([id, s]),
  };
  return { queue, settled };
}
