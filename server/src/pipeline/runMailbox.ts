import { randomUUID } from "node:crypto";
import type { Run } from "@email-manager/shared";
import type { Email } from "../mail/Email";
import { parseEmail } from "../mail/parseEmail";
import { simhash } from "../lowValue/simhash";
import type {
  Classifier, Clock, Mailbox, MailboxCursor, OutcomeLog, RawMessage, RuleSource, RunLock, SenderHistory, SpamCheck,
} from "../ports";
import type { Rule } from "../rules/Rule";
import { prepareLife, type LifeDeps, type LifeRun } from "./lifeDeps";
import { processEmail } from "./processEmail";
import { runPendingActions, type PendingActionQueue } from "./pendingActions";
import { startAfter } from "./startPoint";

export interface RunRecorder {
  save(run: Run): Promise<void>;
}

export interface RunDeps {
  lock: RunLock;
  mailbox: Mailbox;
  cursor: MailboxCursor;
  outcomes: OutcomeLog;
  rules: RuleSource;
  senders: SenderHistory;
  spamCheck: SpamCheck;
  runs: RunRecorder;
  clock: Clock;
  dryRun: boolean;
  classifier?: Classifier;
  life?: LifeDeps;
  /** Panel actions (undo) to carry out before new mail is read. */
  pendingActions?: PendingActionQueue;
  /** AI spend so far in this run, stored on the run row so the daily budget sees it. */
  aiCostUsd?: () => number;
  /** Runs inside the lock before any mail is read (migrations). */
  prepare?: () => Promise<void>;
}

interface Tally {
  fetched: number;
  handledByLogic: number;
  sentToAi: number;
  errors: string[];
}

export interface RunResult {
  run: Run;
  /** The run stopped early (mailbox, store or migration failure), not just one bad message. */
  aborted: boolean;
}

/** Undefined when another run holds the lock. */
export function runMailbox(deps: RunDeps): Promise<RunResult | undefined> {
  return deps.lock.tryRun(() => runLocked(deps));
}

async function runLocked(deps: RunDeps): Promise<RunResult> {
  const started = deps.clock.now();
  const tally: Tally = { fetched: 0, handledByLogic: 0, sentToAi: 0, errors: [] };
  let aborted = false;
  try {
    await deps.prepare?.();
    await carryOutPending(deps, tally);
    await processMailbox(deps, tally);
  } catch (err) {
    aborted = true;
    tally.errors.push(`run: ${errorText(err)}`);
  } finally {
    await deps.mailbox.close().catch(() => undefined);
  }
  const run = toRun(started, deps.clock.now(), tally, deps.aiCostUsd?.() ?? 0);
  await deps.runs.save(run);
  return { run, aborted };
}

/** Skipped in dry-run, so the actions wait for a live run. A failure here never stops new mail. */
async function carryOutPending(deps: RunDeps, tally: Tally): Promise<void> {
  if (deps.dryRun || !deps.pendingActions) return;
  try {
    tally.errors.push(...(await runPendingActions(deps.pendingActions, deps.mailbox)));
  } catch (err) {
    tally.errors.push(`pending actions: ${errorText(err)}`);
  }
}

async function processMailbox(deps: RunDeps, tally: Tally): Promise<void> {
  const state = await deps.mailbox.open();
  let after = startAfter(state, await deps.cursor.get());
  const rules = await deps.rules.activeRules();
  const recentHashes: bigint[] = [];
  const life = deps.life && prepareLife(deps.life);
  for await (const raw of deps.mailbox.fetchSince(after)) {
    tally.fetched++;
    try {
      await handleMessage(raw, { rules, recentHashes, life }, deps, tally);
    } catch (err) {
      tally.errors.push(`uid ${raw.uid}: ${errorText(err)}`);
    }
    after = Math.max(after, raw.uid);
    await deps.cursor.set({ uidValidity: state.uidValidity, uidNext: after + 1 });
  }
}

interface RunState {
  rules: Rule[];
  recentHashes: bigint[];
  life: LifeRun | undefined;
}

async function handleMessage(raw: RawMessage, state: RunState, deps: RunDeps, tally: Tally) {
  const email = await parseEmail(raw.uid, raw.source);
  if (await deps.outcomes.seen(email.messageId)) return;
  const sender = await deps.senders.get(email.from.address);
  const decision = await processEmail(email, raw.source, { ...deps, ...state, sender });
  if (decision.signal === "ai") tally.sentToAi++;
  else tally.handledByLogic++;
  rememberHash(email, state.recentHashes);
  if (email.from.address) await deps.senders.recordReceived(email.from.address);
}

function rememberHash(email: Email, hashes: bigint[]): void {
  hashes.push(simhash(email.text));
}

function toRun(started: Date, ended: Date, t: Tally, costUsd: number): Run {
  return {
    id: randomUUID(),
    startedAt: started.toISOString(),
    durationSec: (ended.getTime() - started.getTime()) / 1000,
    fetched: t.fetched,
    handledByLogic: t.handledByLogic,
    sentToAi: t.sentToAi,
    tokens: 0,
    costUsd,
    error: t.errors.length ? t.errors.join("; ").slice(0, 2000) : undefined,
  };
}

/** Only the error message: never the email it came from. */
function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200);
}
