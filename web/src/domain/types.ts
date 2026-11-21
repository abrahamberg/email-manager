export type Category =
  | "newsletter"
  | "receipt"
  | "notification"
  | "meeting"
  | "question"
  | "marketing"
  | "security";

export type AutonomyLevel = "watch" | "suggest" | "act" | "quiet";

export type Signal = "rule" | "spam" | "headers" | "ai";

export type Outcome = "replied" | "digest" | "junk" | "archived" | "labeled" | "task";

export interface Person {
  name: string;
  address: string;
}

export interface EmailRef {
  id: string;
  from: Person;
  subject: string;
  receivedAt: string;
  snippet: string;
  category: Category;
}

export interface ChoiceOption {
  label: string;
  detail: string;
}

interface DecisionBase {
  id: string;
  email: EmailRef;
  why: string;
}

export type Decision =
  | (DecisionBase & { kind: "reply"; draft: string; confidence: number })
  | (DecisionBase & { kind: "choice"; question: string; options: ChoiceOption[]; recommended: number })
  | (DecisionBase & { kind: "task"; title: string; due?: string })
  | (DecisionBase & { kind: "followUp"; waitingDays: number; draft: string })
  | (DecisionBase & { kind: "ruleProposal"; ruleId: string });

export type DecisionKind = Decision["kind"];

export interface QuickCheck {
  id: string;
  receiptId: string;
  question: string;
}

export interface Receipt {
  id: string;
  email: EmailRef;
  outcome: Outcome;
  signal: Signal;
  reason: string;
  confidence: number;
  at: string;
  byUser?: boolean;
  undone?: boolean;
}

export interface DigestEntry {
  subject: string;
  summary: string;
}

export interface DigestGroup {
  id: string;
  sender: Person;
  category: Category;
  entries: DigestEntry[];
  state: "normal" | "muted" | "unsubscribed" | "promoted";
}

export interface Task {
  id: string;
  title: string;
  owner: "me" | "them";
  email: EmailRef;
  due?: string;
  done: boolean;
}

export interface CategoryPolicy {
  category: Category;
  label: string;
  level: AutonomyLevel;
  correct: number;
  checked: number;
  sendsMail: boolean;
}

export type RuleSourceKind = "feed" | "user" | "ai";

export interface Rule {
  id: string;
  text: string;
  source: RuleSourceKind;
  status: "active" | "proposed" | "disabled";
  hits: number;
}

export interface RuleFeed {
  id: string;
  name: string;
  host: string;
  version: string;
  updatedAt: string;
  verified: boolean;
  ruleCount: number;
}

export interface Run {
  id: string;
  startedAt: string;
  durationSec: number;
  fetched: number;
  handledByLogic: number;
  sentToAi: number;
  tokens: number;
  costUsd: number;
  error?: string;
}

export interface Settings {
  dryRun: boolean;
  mailbox: { host: string; user: string; connected: boolean };
  dailySendCap: number;
  quietHours: { from: string; to: string };
  briefingTimes: string[];
  aiDailyBudgetUsd: number;
  scheduleMinutes: number;
}

export interface Briefing {
  since: string;
  arrived: number;
  nextBriefing: string;
}

export interface AppData {
  briefing: Briefing;
  decisions: Decision[];
  snoozed: Decision[];
  quickChecks: QuickCheck[];
  receipts: Receipt[];
  digest: DigestGroup[];
  tasks: Task[];
  policies: CategoryPolicy[];
  rules: Rule[];
  feeds: RuleFeed[];
  runs: Run[];
  settings: Settings;
}
