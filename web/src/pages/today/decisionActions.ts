import type { Decision } from "../../domain/types";

export interface DecisionLabels {
  accept: string;
  dismiss: string;
  canEdit: boolean;
}

export function labelsFor(decision: Decision, optionIndex: number): DecisionLabels {
  switch (decision.kind) {
    case "reply":
      return { accept: "Send reply", dismiss: "Don't reply", canEdit: true };
    case "followUp":
      return { accept: "Send nudge", dismiss: "Stop waiting", canEdit: true };
    case "choice":
      return { accept: `Send: ${decision.options[optionIndex]?.label ?? ""}`, dismiss: "Ignore", canEdit: false };
    case "task":
      return { accept: "Add to tasks", dismiss: "Not needed", canEdit: true };
    case "ruleProposal":
      return { accept: "Turn on rule", dismiss: "No thanks", canEdit: false };
  }
}
