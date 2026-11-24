import { randomUUID } from "node:crypto";
import type { Run } from "@email-manager/shared";
import type { Classifier, Clock, OutcomeLog, RuleSource, RunLock, SenderHistory, SpamCheck } from "../ports";
import { prepareLife, type LifeDeps } from "./lifeDeps";
import { errorText, mailboxPass, nameOf, type MailboxSource, type PassShared, type Tally } from "./mailboxPass";

export type { MailboxSource } from "./mailboxPass";

export interface RunRecorder {
  save(run: Run): Promise<void>;
}

export interface RunDeps {
  lock: RunLock;
  /** Read inside the lock after prepare, so a mailbox added in the panel is picked up by the next run. */
  mailboxes: () => Promise<MailboxSource[]>;
  outcomes: OutcomeLog;
  rules: RuleSource;
  senders: SenderHistory;
  spamCheck: SpamCheck;
  runs: RunRecorder;
  clock: Clock;
  dryRun: boolean;
  classifier?: Classifier;
  life?: LifeDeps;
  /** AI spend so far in this run, stored on the run row so the daily budget sees it. */
  aiCostUsd?: () => number;
  /** The panel's dry-run switch. It can only add to `dryRun` (the deployment's), never lift it. */
  pausedInPanel?: () => Promise<boolean>;
  /** Runs inside the lock before any mail is read (migrations). */
  prepare?: () => Promise<void>;
}

export interface RunResult {
  run: Run;
  /** The run stopped early or a mailbox failed (sign-in, connection, store), not just one bad message. */
  aborted: boolean;
  /** How many mailboxes the run looked at; 0 means none is set up and no run row was saved. */
  mailboxes: number;
}

/** Undefined when another run holds the lock. */
export function runMailbox(deps: RunDeps): Promise<RunResult | undefined> {
  return deps.lock.tryRun(() => runLocked(deps));
}

async function runLocked(given: RunDeps): Promise<RunResult> {
  let deps = given;
  const started = deps.clock.now();
  const tally: Tally = { fetched: 0, handledByLogic: 0, sentToAi: 0, errors: [] };
  let aborted = false;
  let sources: MailboxSource[] = [];
  try {
    await deps.prepare?.();
    if (!deps.dryRun && (await deps.pausedInPanel?.())) deps = { ...deps, dryRun: true };
    sources = await deps.mailboxes();
    if (sources.length > 0) aborted = await passAll(sources, await sharedState(deps), deps, tally);
  } catch (err) {
    aborted = true;
    tally.errors.push(`run: ${errorText(err)}`);
  }
  const run = toRun(started, deps.clock.now(), tally, deps.aiCostUsd?.() ?? 0);
  if (sources.length > 0 || aborted) await deps.runs.save(run);
  return { run, aborted, mailboxes: sources.length };
}

async function sharedState(deps: RunDeps): Promise<PassShared> {
  return { rules: await deps.rules.activeRules(), recentHashes: [], life: deps.life && prepareLife(deps.life) };
}

/** Each mailbox in turn; one that fails is noted on the run and the rest still run. */
async function passAll(sources: MailboxSource[], shared: PassShared, deps: RunDeps, tally: Tally): Promise<boolean> {
  let failed = false;
  for (const source of sources) {
    try {
      await mailboxPass(source, shared, deps, tally);
    } catch (err) {
      failed = true;
      tally.errors.push(`mailbox ${nameOf(source)}: ${errorText(err)}`);
    }
  }
  return failed;
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
