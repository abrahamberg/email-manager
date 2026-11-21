import type { AppData, Decision, MailboxProfile, Outcome, Settings, Task } from "@email-manager/shared";
import type { Db } from "../store/db";
import { createStore, type Store } from "../store";
import {
  buildBriefing, buildDetails, buildDigest, buildReceipts, buildReportItems, buildTasks, loadReferenced,
} from "./buildReport";
import { outcomeCounts, outcomesFor, outcomesSince, profileCounts, type MessageRow } from "./today/queries";
import { emailRef } from "./today/refs";
import type { StoredTask } from "../store/tasks";
import { startOfTodayStockholm } from "./today/time";

const RECENT_RUNS = 20;
const DAY_MS = 86_400_000;

export const DEFAULT_SETTINGS: Settings = {
  dryRun: true,
  replies: { signature: "", knownContactsOnly: true, topics: [], neverAutoReplyTo: [] },
  mailbox: { host: "", user: "", connected: false },
  dailySendCap: 10,
  quietHours: { from: "19:00", to: "07:30" },
  briefingTimes: ["08:00", "13:00", "17:00"],
  aiDailyBudgetUsd: 0.5,
  scheduleMinutes: 15,
};

const byDeadline = (a: Decision, b: Decision) =>
  (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");

export async function buildProfile(db: Db, now: Date): Promise<MailboxProfile> {
  const c = await profileCounts(db);
  const first = c.first ? new Date(c.first as string | Date).getTime() : now.getTime();
  const counts = await outcomeCounts(db);
  return {
    daysRead: c.emails ? Math.max(1, Math.ceil((now.getTime() - first) / DAY_MS)) : 0,
    emailsRead: c.emails, peopleYouReplyTo: c.replied, newsletters: c.newsletters, toneSummary: "",
    wouldHaveDone: counts.filter((x) => x.outcome !== "kept").map((x) => ({ outcome: x.outcome as Outcome, count: x.n })),
  };
}

function storedTasks(rows: StoredTask[], msgs: Map<string, MessageRow>, now: Date): Task[] {
  return rows.map((t) => ({
    id: t.id, title: t.title, owner: t.owner, done: t.done, ...(t.due ? { due: t.due } : {}),
    email: emailRef(t.messageId, msgs.get(t.messageId), { at: now.toISOString() }),
  }));
}

export async function buildAppData(db: Db, now = new Date(), store: Store = createStore(db)): Promise<AppData> {
  const dayStart = startOfTodayStockholm(now);
  const [settingsRow, pendingRaw, snoozed, areas, facts, streams, feeds, runs, rules, today, lastBriefing, policies, quickChecks, tasks] =
    await Promise.all([
      store.settings.get(), store.decisions.pending(), store.decisions.snoozed(), store.areas.list(),
      store.facts.list(), store.streams.list(), store.rules.feeds(), store.runs.recent(RECENT_RUNS),
      store.rules.listShared(), outcomesSince(db, dayStart), store.briefings.get(), store.policies.list(),
      store.quickChecks.listOpen(), store.tasks.list(),
    ]);
  const settings = { ...DEFAULT_SETTINGS, ...settingsRow };
  const since = lastBriefing ?? dayStart;
  const sinceOutcomes = since === dayStart ? today : await outcomesSince(db, since);
  const decisions = [...pendingRaw].sort(byDeadline);
  const ids = [
    ...today.map((o) => o.messageId), ...sinceOutcomes.map((o) => o.messageId), ...decisions.map((d) => d.email.id),
    ...snoozed.map((d) => d.email.id), ...streams.map((s) => s.emailId), ...tasks.map((t) => t.messageId),
    ...facts.flatMap((f) => (f.sourceEmailId ? [f.sourceEmailId] : [])),
  ];
  const msgs = await loadReferenced(db, ids);
  const trace = await outcomesFor(db, [...new Set(ids)]);
  return {
    briefing: await buildBriefing(db, since, now, settings, sinceOutcomes, msgs),
    profile: await buildProfile(db, now),
    areas, facts, decisions, snoozed, streams, feeds, runs, settings,
    details: buildDetails(ids, msgs, trace),
    report: buildReportItems(today, msgs),
    quickChecks,
    receipts: buildReceipts(today, msgs),
    digest: buildDigest(today, msgs),
    tasks: [...storedTasks(tasks, msgs, now), ...buildTasks(decisions)],
    policies,
    rules,
  };
}
