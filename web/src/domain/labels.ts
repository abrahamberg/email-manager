import type { DecisionKind, Outcome, ReplyTopic, RuleSourceKind, Signal } from "./types";

export const OUTCOME_LABELS: Record<Outcome, string> = {
  replied: "Replied",
  digest: "Moved to digest",
  junk: "Moved to junk",
  archived: "Archived",
  labeled: "Labelled",
  task: "Became a task",
};

export const SIGNAL_LABELS: Record<Signal, string> = {
  rule: "Your rule",
  spam: "Spam check",
  headers: "Mail headers",
  ai: "AI",
};

export const DECISION_TITLES: Record<DecisionKind, string> = {
  reply: "Reply ready",
  choice: "Your choice needed",
  task: "Needs your attention",
  followUp: "Follow up",
  ruleProposal: "New rule proposal",
};

export const RULE_SOURCE_LABELS: Record<RuleSourceKind, string> = {
  feed: "Trusted feed",
  user: "You",
  ai: "Learned by AI",
};

export const REPLY_TOPIC_LABELS: Record<ReplyTopic, string> = {
  acknowledge: "Confirm I received something",
  confirmAppointment: "Confirm appointments that match my calendar",
  schedule: "Propose meeting times from my calendar",
  declinePolitely: "Politely decline sales and recruiter mail",
  shareKnownInfo: "Answer with facts I've already shared before",
};
