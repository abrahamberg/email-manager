import type { Email } from "../mail/Email";
import { parseEmail } from "../mail/parseEmail";
import { simhash } from "../lowValue/simhash";
import type { Mailbox, MailboxCursor, RawMessage } from "../ports";
import type { Rule } from "../rules/Rule";
import type { LifeRun } from "./lifeDeps";
import { processEmail } from "./processEmail";
import { runPendingActions, type PendingActionQueue } from "./pendingActions";
import type { RunDeps } from "./runMailbox";
import { startAfter } from "./startPoint";

/** One configured mailbox in a run. Cursor and queue are its own; nothing is shared across mailboxes. */
export interface MailboxSource {
  id: string;
  mailbox: Mailbox;
  cursor: MailboxCursor;
  /** Panel actions (undo) queued for this mailbox, carried out before new mail is read. */
  pendingActions?: PendingActionQueue;
  /** The account address, used as the From of drafts made in this mailbox. */
  address?: string;
}

export interface Tally {
  fetched: number;
  handledByLogic: number;
  sentToAi: number;
  errors: string[];
}

export interface PassShared {
  rules: Rule[];
  recentHashes: bigint[];
  life: LifeRun | undefined;
}

/** Throws when the mailbox itself fails (sign-in, connection); one bad message is only tallied. */
export async function mailboxPass(source: MailboxSource, shared: PassShared, deps: RunDeps, tally: Tally): Promise<void> {
  const life = shared.life && forMailbox(shared.life, source);
  try {
    await carryOutPending(source, deps, tally);
    await readNewMail(source, { ...shared, life }, deps, tally);
  } finally {
    await source.mailbox.close().catch(() => undefined);
  }
}

function forMailbox(life: LifeRun, source: MailboxSource): LifeRun {
  const user = source.address ? { address: source.address, name: source.address.split("@")[0] ?? "" } : life.user;
  return { ...life, mailboxId: source.id, user };
}

/** Skipped in dry-run, so the actions wait for a live run. A failure here never stops new mail. */
async function carryOutPending(source: MailboxSource, deps: RunDeps, tally: Tally): Promise<void> {
  if (deps.dryRun || !source.pendingActions) return;
  try {
    tally.errors.push(...(await runPendingActions(source.pendingActions, source.mailbox)).map((e) => `${source.id}: ${e}`));
  } catch (err) {
    tally.errors.push(`${source.id}: pending actions: ${errorText(err)}`);
  }
}

async function readNewMail(source: MailboxSource, shared: PassShared, deps: RunDeps, tally: Tally): Promise<void> {
  const state = await source.mailbox.open();
  let after = startAfter(state, await source.cursor.get());
  for await (const raw of source.mailbox.fetchSince(after)) {
    tally.fetched++;
    try {
      await handleMessage(raw, source, shared, deps, tally);
    } catch (err) {
      tally.errors.push(`${source.id} uid ${raw.uid}: ${errorText(err)}`);
    }
    after = Math.max(after, raw.uid);
    await source.cursor.set({ uidValidity: state.uidValidity, uidNext: after + 1 });
  }
}

async function handleMessage(raw: RawMessage, source: MailboxSource, shared: PassShared, deps: RunDeps, tally: Tally) {
  const email = await parseEmail(raw.uid, raw.source);
  // Why: seen is global, so a message delivered to two mailboxes is decided once.
  if (await deps.outcomes.seen(email.messageId)) return;
  const sender = await deps.senders.get(email.from.address);
  const decision = await processEmail(email, raw.source, {
    ...deps, ...shared, sender, mailbox: source.mailbox, mailboxId: source.id,
  });
  if (decision.signal === "ai") tally.sentToAi++;
  else tally.handledByLogic++;
  rememberHash(email, shared.recentHashes);
  if (email.from.address) await deps.senders.recordReceived(email.from.address);
}

function rememberHash(email: Email, hashes: bigint[]): void {
  hashes.push(simhash(email.text));
}

/** Only the error message: never the email it came from. */
export function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200);
}
