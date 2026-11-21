import type {
  AppData, CategoryPolicy, Decision, MailboxProfile, Outcome, Rule, Settings,
} from "@email-manager/shared";
import type { Db } from "../store/db";
import { createStore, type Store } from "../store";
import {
  buildBriefing, buildDetails, buildDigest, buildReceipts, buildReportItems, buildTasks, loadReferenced,
} from "./buildReport";
import { allRules, outcomeCounts, outcomesFor, outcomesSince, profileCounts, type RuleRow } from "./today/queries";
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

const POLICIES: [CategoryPolicy["category"], string, boolean][] = [
  ["security", "Spam and phishing", false], ["newsletter", "Newsletters", false],
  ["marketing", "Marketing and offers", false], ["notification", "Notifications", false],
  ["receipt", "Receipts and statements", false], ["meeting", "Meeting requests", true],
  ["question", "Questions from contacts", true],
];

export const defaultPolicies = (): CategoryPolicy[] =>
  POLICIES.map(([category, label, sendsMail]) => ({ category, label, level: "suggest", correct: 0, checked: 0, sendsMail }));

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

function toRule(r: RuleRow): Rule {
  const d = r.definition ?? {};
  return {
    id: r.id, text: r.text || `Rule ${r.id}`, source: r.source, status: r.status, hits: r.hits,
    ...(Array.isArray(d.when) ? { when: d.when as Rule["when"] } : {}),
    ...(d.then ? { then: d.then as Rule["then"] } : {}),
  };
}

export async function buildAppData(db: Db, now = new Date(), store: Store = createStore(db)): Promise<AppData> {
  const since = startOfTodayStockholm(now);
  const [settingsRow, pendingRaw, snoozed, areas, facts, streams, feeds, runs, ruleRows, today] = await Promise.all([
    store.settings.get(), store.decisions.pending(), store.decisions.snoozed(), store.areas.list(),
    store.facts.list(), store.streams.list(), store.rules.feeds(), store.runs.recent(RECENT_RUNS),
    allRules(db), outcomesSince(db, since),
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...settingsRow };
  const decisions = [...pendingRaw].sort(byDeadline);
  const ids = [
    ...today.map((o) => o.messageId), ...decisions.map((d) => d.email.id), ...snoozed.map((d) => d.email.id),
    ...streams.map((s) => s.emailId), ...facts.flatMap((f) => (f.sourceEmailId ? [f.sourceEmailId] : [])),
  ];
  const msgs = await loadReferenced(db, ids);
  const trace = await outcomesFor(db, [...new Set(ids)]);
  return {
    briefing: await buildBriefing(db, since, now, settings, today, msgs),
    profile: await buildProfile(db, now),
    areas, facts, decisions, snoozed, streams, feeds, runs, settings,
    details: buildDetails(ids, msgs, trace),
    report: buildReportItems(today, msgs),
    quickChecks: [],
    receipts: buildReceipts(today, msgs),
    digest: buildDigest(today, msgs),
    tasks: buildTasks(decisions),
    policies: defaultPolicies(),
    rules: ruleRows.map(toRule),
  };
}
