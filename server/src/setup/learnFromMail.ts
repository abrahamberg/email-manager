import { parseFrom, parseHeaderBlock } from "../mail/headerBlock.js";
import type { ReadOnlyMailbox } from "./readOnly.js";
import { failureCode, type FailureCode } from "./checkConnection.js";
import { groupBulk, kindOf, type KindGroup, type MailKind } from "./groupMail.js";

export const LEARN_DAYS = 30;
/** Headers come in one request, so this only bounds memory on a huge mailbox. */
export const LEARN_MAX_MESSAGES = 5000;
const DAY_MS = 86_400_000;

export interface LearnSummary {
  daysRead: number;
  emailsRead: number;
  distinctSenders: number;
  /** Bulk mail of any kind: newsletters, lists and automatic notifications. */
  newsletters: number;
  /** Mail from people, which is what would still reach the user. */
  needsYou: number;
  groups: KindGroup[];
}

export type LearnResult = { ok: true; summary: LearnSummary } | { ok: false; error: FailureCode };

/** Reads the headers of the last 30 days and sorts them. Nothing is stored and nothing is changed. */
export async function learnFromMail(mailbox: ReadOnlyMailbox, now: Date): Promise<LearnResult> {
  try {
    return { ok: true, summary: await tally(mailbox, now) };
  } catch (err) {
    return { ok: false, error: failureCode(err) };
  } finally {
    await mailbox.close().catch(() => undefined);
  }
}

async function tally(mailbox: ReadOnlyMailbox, now: Date): Promise<LearnSummary> {
  const since = now.getTime() - LEARN_DAYS * DAY_MS;
  const state = await mailbox.open();
  const items: { kind: MailKind; sender: string }[] = [];
  for await (const scan of mailbox.scanHeaders(Math.max(0, state.uidNext - 1 - LEARN_MAX_MESSAGES))) {
    if (!(Date.parse(scan.receivedAt) >= since)) continue;
    const headers = parseHeaderBlock(scan.headers);
    const from = parseFrom(headers["from"]);
    if (from.address) items.push({ kind: kindOf({ from, headers }), sender: from.address });
  }
  const bulk = items.filter((i) => i.kind !== "personal");
  return {
    daysRead: LEARN_DAYS,
    emailsRead: items.length,
    distinctSenders: new Set(items.map((i) => i.sender)).size,
    newsletters: bulk.length,
    needsYou: items.length - bulk.length,
    groups: groupBulk(items),
  };
}
