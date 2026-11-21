// The pipeline depends only on these interfaces. main.ts and worker.ts are the
// only files that pick concrete adapters, so swapping a provider, spam engine
// or model touches one adapter file and nothing else.
import type { Category, Outcome, Signal, FactKind, ReplyTopic } from "@email-manager/shared";
import type { Email } from "./mail/Email";
import type { Rule } from "./rules/Rule";

// ── Mail ────────────────────────────────────────────────────────────────────

export interface MailboxState {
  uidValidity: number;
  uidNext: number;
}

export interface RawMessage {
  uid: number;
  source: Uint8Array;
}

/** Why: IMAP details (UIDs, folders, flags) stay in one adapter. */
export interface Mailbox {
  open(): Promise<MailboxState>;
  fetchSince(uid: number): AsyncIterable<RawMessage>;
  moveTo(uid: number, folder: "junk" | "archive"): Promise<void>;
  /** Moves a message back by its Message-ID header; false when no such message is in that folder. */
  moveToInbox(messageId: string, from: "junk" | "archive"): Promise<boolean>;
  addLabel(uid: number, label: string): Promise<void>;
  appendDraft(rfc822: string): Promise<void>;
  close(): Promise<void>;
}

export type MailCredentials =
  | { kind: "password"; user: string; password: string }
  | { kind: "oauth"; user: string; accessToken: string };

/** Why: generic IMAP, Office 365 and Gmail differ only in how they sign in. */
export interface MailAuth {
  credentials(): Promise<MailCredentials>;
}

export interface OutgoingMail {
  to: string[];
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
}

/** Why: sending is off in v1 (drafts only); this is the one place it can happen. */
export interface ReplySender {
  send(mail: OutgoingMail): Promise<void>;
}

// ── Spam ────────────────────────────────────────────────────────────────────

export interface SpamVerdict {
  score: number;
  isSpam: boolean;
  symbols: string[];
}

/** Why: Rspamd today, something else tomorrow. Undefined means "unavailable", never "spam". */
export interface SpamCheck {
  check(raw: Uint8Array): Promise<SpamVerdict | undefined>;
}

// ── AI ──────────────────────────────────────────────────────────────────────

/** The capped, stripped text the model sees. Never the full raw message. */
export interface CompactEmail {
  from: string;
  subject: string;
  date: string;
  text: string;
}

export type Tier = "dontMiss" | "worthKnowing" | "notWorth";

export interface FactDraft {
  kind: FactKind;
  title: string;
  detail: string;
  at?: string;
  place?: string;
}

export interface Triage {
  tier: Tier;
  category: Category;
  areaId?: string;
  matter?: string;
  need?: string;
  deadline?: string;
  needsReply: boolean;
  facts: FactDraft[];
  confidence: number;
  why: string;
}

export interface TriageContext {
  areas: { id: string; name: string; note?: string }[];
}

/** Why: the model is replaceable and testable with recorded responses. */
export interface Classifier {
  triage(email: CompactEmail, context: TriageContext): Promise<Triage>;
}

export interface Draft {
  text: string;
  confidence: number;
}

/** Undefined on any failure: the caller then makes no draft rather than a bad one. */
export interface Drafter {
  draftReply(email: CompactEmail, context: { userName: string; areaNote?: string }): Promise<(Draft & { topic: ReplyTopic }) | undefined>;
}

/** Why: local model in production, a fake in tests; mail text never leaves the cluster. */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

// ── State ───────────────────────────────────────────────────────────────────

export interface OutcomeRecord {
  messageId: string;
  uid: number;
  outcome: Outcome | "kept";
  signal: Signal;
  reason: string;
  confidence?: number;
  areaId?: string;
  tier?: Tier;
  dryRun: boolean;
  at: string;
}

export interface OutcomeLog {
  record(outcome: OutcomeRecord): Promise<void>;
  seen(messageId: string): Promise<boolean>;
}

export interface RuleSource {
  activeRules(): Promise<Rule[]>;
}

export interface SenderStats {
  address: string;
  received: number;
  repliedTo: number;
  opened: number;
}

/** Why: "known contact" and "low value" both depend on history with a sender. */
export interface SenderHistory {
  get(address: string): Promise<SenderStats | undefined>;
  recordReceived(address: string): Promise<void>;
}

export interface MailboxCursor {
  get(): Promise<MailboxState | undefined>;
  set(state: MailboxState): Promise<void>;
}

/** Why: CronJob runs can overlap; a second run must do nothing. */
export interface RunLock {
  tryRun<T>(work: () => Promise<T>): Promise<T | undefined>;
}

export interface Clock {
  now(): Date;
}

/** Emails the pipeline decided on, for the parsed form downstream steps need. */
export type { Email };
