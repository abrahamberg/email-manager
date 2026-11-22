import { bulkSignals } from "../lowValue/bulkHeaders.js";
import { parseEmail } from "../mail/parseEmail.js";
import type { ReadOnlyMailbox } from "./readOnly.js";
import { failureCode, type FailureCode } from "./checkConnection.js";

export const LEARN_DAYS = 30;
/**
 * Bounds the work on a large mailbox: only the newest UIDs are looked at. Each message is one
 * IMAP round trip (about 0.3 s), and the request must finish within the proxy's 100 s limit.
 */
export const LEARN_MAX_MESSAGES = 200;
const DAY_MS = 86_400_000;

export interface LearnSummary {
  daysRead: number;
  emailsRead: number;
  distinctSenders: number;
  newsletters: number;
}

export type LearnResult = { ok: true; summary: LearnSummary } | { ok: false; error: FailureCode };

/** Reads the last 30 days of the inbox and counts. Nothing is stored and nothing is changed. */
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
  const senders = new Set<string>();
  let emailsRead = 0;
  let newsletters = 0;
  for await (const raw of mailbox.fetchSince(Math.max(0, state.uidNext - 1 - LEARN_MAX_MESSAGES))) {
    const email = await parseEmail(raw.uid, raw.source);
    if (!(Date.parse(email.date) >= since)) continue;
    emailsRead++;
    if (email.from.address) senders.add(email.from.address.toLowerCase());
    if (bulkSignals(email).isBulk) newsletters++;
  }
  return { daysRead: LEARN_DAYS, emailsRead, distinctSenders: senders.size, newsletters };
}
