import type { Email } from "../mail/Email";

export interface BulkSignals {
  isBulk: boolean;
  listId?: string;
  unsubscribe?: string;
  reasons: string[];
}

const BULK_PRECEDENCE = new Set(["bulk", "list", "junk"]);
const NOREPLY = /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon)([+._-].*)?$/i;

function listIdOf(raw: string): string {
  const bracketed = /<([^>]+)>/.exec(raw);
  return (bracketed?.[1] ?? raw).trim();
}

function firstUnsubscribe(raw: string): string {
  return /<([^>]+)>/.exec(raw)?.[1]?.trim() ?? raw.trim();
}

export function bulkSignals(email: Pick<Email, "headers" | "from">): BulkSignals {
  const h = email.headers;
  const reasons: string[] = [];
  const out: BulkSignals = { isBulk: false, reasons };

  if (h["list-id"]?.trim()) {
    out.listId = listIdOf(h["list-id"]);
    reasons.push("List-Id");
  }
  if (h["list-unsubscribe"]?.trim()) {
    out.unsubscribe = firstUnsubscribe(h["list-unsubscribe"]);
    reasons.push("List-Unsubscribe");
  }
  if (BULK_PRECEDENCE.has((h["precedence"] ?? "").trim().toLowerCase())) reasons.push("Precedence");
  const auto = (h["auto-submitted"] ?? "").trim().toLowerCase();
  if (auto && auto !== "no") reasons.push("Auto-Submitted");
  if (h["x-auto-response-suppress"]?.trim()) reasons.push("X-Auto-Response-Suppress");
  if (NOREPLY.test(email.from.address.split("@")[0] ?? "")) reasons.push("noreply sender");

  out.isBulk = reasons.length > 0;
  return out;
}
