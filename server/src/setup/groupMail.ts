import { bulkSignals } from "../lowValue/bulkHeaders.js";
import type { Email } from "../mail/Email.js";

export type MailKind = "personal" | "newsletters" | "notifications";

export interface Scanned {
  from: Email["from"];
  headers: Email["headers"];
}

const AUTOMATIC = new Set(["noreply sender", "Auto-Submitted", "X-Auto-Response-Suppress"]);

/** Notifications are machine mail with no list to leave; the rest of bulk mail is a list. */
export function kindOf(mail: Scanned): MailKind {
  const { isBulk, reasons } = bulkSignals(mail);
  if (!isBulk) return "personal";
  const isList = reasons.some((r) => !AUTOMATIC.has(r));
  return isList ? "newsletters" : "notifications";
}

export interface SenderCount {
  sender: string;
  emails: number;
}

export interface KindGroup {
  kind: Exclude<MailKind, "personal">;
  emails: number;
  senders: number;
  top: SenderCount[];
}

const TOP_SENDERS = 3;

export function topSenders(counts: Map<string, number>): SenderCount[] {
  return [...counts]
    .map(([sender, emails]) => ({ sender, emails }))
    .sort((a, b) => b.emails - a.emails || a.sender.localeCompare(b.sender))
    .slice(0, TOP_SENDERS);
}

/** Bulk mail grouped by kind, biggest first. */
export function groupBulk(items: { kind: MailKind; sender: string }[]): KindGroup[] {
  const by = new Map<KindGroup["kind"], Map<string, number>>();
  for (const { kind, sender } of items) {
    if (kind === "personal") continue;
    const counts = by.get(kind) ?? new Map<string, number>();
    counts.set(sender, (counts.get(sender) ?? 0) + 1);
    by.set(kind, counts);
  }
  return [...by]
    .map(([kind, counts]) => ({ kind, emails: sum(counts), senders: counts.size, top: topSenders(counts) }))
    .sort((a, b) => b.emails - a.emails);
}

const sum = (counts: Map<string, number>) => [...counts.values()].reduce((a, b) => a + b, 0);
