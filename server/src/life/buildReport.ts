import type {
  Briefing, Category, Decision, DigestGroup, EmailDetail, Outcome, PipelineStage, Receipt, ReportItem, Settings, Task,
} from "@email-manager/shared";
import type { OutcomeRecord } from "../ports";
import type { Db } from "../store/db";
import { countMessagesSince, messagesByIds, type MessageRow } from "./today/queries";
import { refForOutcome } from "./today/refs";
import { nextBriefing } from "./today/time";

type Msgs = Map<string, MessageRow>;
type Handled = OutcomeRecord & { outcome: Outcome };

const isHandled = (o: OutcomeRecord): o is Handled => o.outcome !== "kept";

const IGNORED_LABEL: Partial<Record<Category, string>> = {
  newsletter: "newsletters", marketing: "promotions", notification: "notifications", security: "spam",
};

export function ignoredCounts(outcomes: OutcomeRecord[], msgs: Msgs): Briefing["ignored"] {
  const counts = new Map<string, number>();
  for (const o of outcomes) {
    if (o.outcome !== "digest" && o.outcome !== "junk") continue;
    const cat = msgs.get(o.messageId)?.category;
    const label = o.outcome === "junk" ? "spam" : (cat && IGNORED_LABEL[cat]) || "newsletters";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function buildBriefing(
  db: Db, since: string, now: Date, settings: Settings, outcomes: OutcomeRecord[], msgs: Msgs,
): Promise<Briefing> {
  return {
    since,
    arrived: await countMessagesSince(db, since),
    nextBriefing: nextBriefing(settings.briefingTimes, now),
    ignored: ignoredCounts(outcomes, msgs),
  };
}

/** Worth knowing: the assistant filed or labelled something in a life area, nothing to do. */
export function buildReportItems(outcomes: OutcomeRecord[], msgs: Msgs): ReportItem[] {
  return outcomes
    .filter((o) => (o.outcome === "archived" || o.outcome === "labeled") && o.areaId && !o.dryRun)
    .map((o) => ({
      id: `rep-${o.messageId}`,
      areaId: o.areaId!,
      text: (msgs.get(o.messageId)?.subject || o.reason).replace(/\s+/g, " ").slice(0, 140),
      emailId: o.messageId,
    }));
}

export function buildReceipts(outcomes: OutcomeRecord[], msgs: Msgs): Receipt[] {
  return outcomes.filter(isHandled).map((o) => ({
    id: `rc-${o.messageId}-${o.outcome}`,
    email: refForOutcome(o, msgs),
    outcome: o.outcome,
    signal: o.signal,
    reason: o.reason,
    confidence: o.confidence ?? 1,
    at: o.at,
  }));
}

export function buildDigest(outcomes: OutcomeRecord[], msgs: Msgs): DigestGroup[] {
  const groups = new Map<string, DigestGroup>();
  for (const o of outcomes) {
    const m = msgs.get(o.messageId);
    if (o.outcome !== "digest" || !m) continue;
    const g = groups.get(m.from.address) ?? {
      id: `dg-${m.from.address}`, sender: m.from, category: m.category ?? "newsletter", entries: [], state: "normal" as const,
    };
    g.entries.push({ subject: m.subject, summary: m.compactText.slice(0, 200) });
    groups.set(m.from.address, g);
  }
  return [...groups.values()];
}

export function buildTasks(pending: Decision[]): Task[] {
  return pending.flatMap((d) =>
    d.kind === "task" ? [{ id: `task-${d.id}`, title: d.title, owner: "me" as const, email: d.email, due: d.due, done: false }] : [],
  );
}

const STAGE: Record<string, PipelineStage> = { rule: "rules", spam: "spam", headers: "lowValue", ai: "ai" };

export function buildDetails(ids: string[], msgs: Msgs, outcomes: OutcomeRecord[]): Record<string, EmailDetail> {
  const details: Record<string, EmailDetail> = {};
  for (const id of new Set(ids)) {
    const m = msgs.get(id);
    details[id] = {
      body: m?.compactText ?? "",
      to: "",
      auth: { spf: "none", dkim: "none", dmarc: "none" },
      spamScore: 0,
      bulkHeaders: [],
      trace: outcomes.filter((o) => o.messageId === id).map((o) => ({
        stage: STAGE[o.signal] ?? "rules", result: "decided" as const, note: o.reason,
      })),
    };
  }
  return details;
}

export async function loadReferenced(db: Db, ids: string[]): Promise<Msgs> {
  return messagesByIds(db, [...new Set(ids)]);
}

