import type { Outcome, Signal } from "@email-manager/shared";
import type { Email } from "../mail/Email";
import type { Clock, Mailbox, OutcomeLog, Tier } from "../ports";
import type { Action } from "../rules/Rule";

export type MailAction =
  | { kind: "move"; folder: "junk" | "archive" }
  | { kind: "label"; label: string };

/** What the pipeline decided, before anything touches the mailbox. */
export interface Decision {
  outcome: Outcome | "kept";
  signal: Signal;
  reason: string;
  confidence?: number;
  actions: MailAction[];
  /** Set when triage or a stream decided: the report reads the tier and area. */
  tier?: Tier;
  areaId?: string;
}

export const DIGEST_LABEL = "Digest";

export function moveToJunk(reason: string): Decision {
  return { outcome: "junk", signal: "spam", reason, actions: [{ kind: "move", folder: "junk" }] };
}

export function addToDigest(signal: Signal, reason: string): Decision {
  return {
    outcome: "digest",
    signal,
    reason,
    actions: [{ kind: "label", label: DIGEST_LABEL }, { kind: "move", folder: "archive" }],
  };
}

export function keepInInbox(signal: Signal, reason: string, confidence?: number): Decision {
  return { outcome: "kept", signal, reason, confidence, actions: [] };
}

export function ruleDecision(action: Action, ruleId: string): Decision {
  const reason = `Matched rule ${ruleId}.`;
  switch (action.kind) {
    case "junk":
      return { ...moveToJunk(reason), signal: "rule" };
    case "digest":
      return addToDigest("rule", reason);
    case "archive":
      return { outcome: "archived", signal: "rule", reason, actions: [{ kind: "move", folder: "archive" }] };
    case "label": {
      const label = action.label ?? "Labeled";
      return { outcome: "labeled", signal: "rule", reason, actions: [{ kind: "label", label }] };
    }
    case "task":
      return { outcome: "task", signal: "rule", reason, actions: [] };
    case "alwaysShow":
      return keepInInbox("rule", reason);
  }
}

export interface ApplyDeps {
  mailbox: Mailbox;
  /** Recorded with the outcome, so undo later acts on the mailbox the message is in. */
  mailboxId?: string;
  outcomes: OutcomeLog;
  clock: Clock;
  dryRun: boolean;
}

/** Labels before moves: once moved, the UID no longer points into the inbox. */
export async function applyDecision(decision: Decision, email: Email, deps: ApplyDeps): Promise<Decision> {
  if (!deps.dryRun) {
    const ordered = [...decision.actions].sort((a, b) => Number(a.kind === "move") - Number(b.kind === "move"));
    for (const action of ordered) await runAction(action, email.uid, deps.mailbox);
  }
  await deps.outcomes.record({
    messageId: email.messageId,
    uid: email.uid,
    outcome: decision.outcome,
    signal: decision.signal,
    reason: decision.reason,
    confidence: decision.confidence,
    ...(decision.tier ? { tier: decision.tier } : {}),
    ...(decision.areaId ? { areaId: decision.areaId } : {}),
    dryRun: deps.dryRun,
    at: deps.clock.now().toISOString(),
    ...(deps.mailboxId ? { mailboxId: deps.mailboxId } : {}),
  });
  return decision;
}

function runAction(action: MailAction, uid: number, mailbox: Mailbox): Promise<void> {
  return action.kind === "move" ? mailbox.moveTo(uid, action.folder) : mailbox.addLabel(uid, action.label);
}
