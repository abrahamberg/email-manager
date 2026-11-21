import type { AppData, Decision, DecisionKind } from "./types";

const SECONDS_PER_DECISION: Record<DecisionKind, number> = {
  reply: 45,
  choice: 20,
  task: 20,
  followUp: 15,
  ruleProposal: 10,
};

const SECONDS_PER_QUICK_CHECK = 5;

export function estimateMinutes(decisions: Decision[], quickChecks: number): number {
  const seconds =
    decisions.reduce((sum, decision) => sum + SECONDS_PER_DECISION[decision.kind], 0) +
    quickChecks * SECONDS_PER_QUICK_CHECK;
  return seconds === 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}

export function handledAutomatically(data: AppData): number {
  return data.receipts.filter((receipt) => !receipt.byUser && !receipt.undone).length;
}

export interface BriefingSummary {
  arrived: number;
  handled: number;
  needYou: number;
  quickChecks: number;
  minutes: number;
}

export function summarizeBriefing(data: AppData): BriefingSummary {
  return {
    arrived: data.briefing.arrived,
    handled: handledAutomatically(data),
    needYou: dontMiss(data.decisions).length,
    quickChecks: data.quickChecks.length,
    minutes: estimateMinutes(dontMiss(data.decisions), data.quickChecks.length),
  };
}

// Rule proposals are about how the assistant works, not about the user's
// life, so they wait in Delegation instead of competing for attention.
export function dontMiss(decisions: Decision[]): Decision[] {
  return decisions.filter((decision) => decision.kind !== "ruleProposal");
}

export function ignoredTotal(data: AppData): number {
  return data.briefing.ignored.reduce((sum, group) => sum + group.count, 0);
}
