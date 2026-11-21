import type { AppData, Decision } from "../domain/types";
import type { DecisionEdit } from "./actions";
import { newTask, userReceipt } from "./records";
import { setRuleStatus } from "./delegation";

function withoutDecision(data: AppData, id: string): AppData {
  return { ...data, decisions: data.decisions.filter((decision) => decision.id !== id) };
}

function findDecision(data: AppData, id: string): Decision | undefined {
  return data.decisions.find((decision) => decision.id === id);
}

function acceptedResult(data: AppData, decision: Decision, edit: DecisionEdit = {}): AppData {
  const { email } = decision;
  switch (decision.kind) {
    case "reply":
    case "followUp":
      return { ...data, receipts: [userReceipt(email, "replied", "You approved the drafted reply"), ...data.receipts] };
    case "choice": {
      const option = decision.options[edit.optionIndex ?? decision.recommended];
      return { ...data, receipts: [userReceipt(email, "replied", `You chose: ${option?.label}`), ...data.receipts] };
    }
    case "task": {
      const task = newTask(email, edit.title ?? decision.title, edit.due ?? decision.due);
      return {
        ...data,
        tasks: [task, ...data.tasks],
        receipts: [userReceipt(email, "task", "You added it to your tasks"), ...data.receipts],
      };
    }
    case "ruleProposal":
      return setRuleStatus(data, decision.ruleId, "active");
  }
}

function dismissedResult(data: AppData, decision: Decision): AppData {
  if (decision.kind === "ruleProposal") return setRuleStatus(data, decision.ruleId, "disabled");
  return { ...data, receipts: [userReceipt(decision.email, "archived", "You chose not to act"), ...data.receipts] };
}

export function acceptDecision(data: AppData, id: string, edit?: DecisionEdit): AppData {
  const decision = findDecision(data, id);
  return decision ? acceptedResult(withoutDecision(data, id), decision, edit) : data;
}

export function dismissDecision(data: AppData, id: string): AppData {
  const decision = findDecision(data, id);
  return decision ? dismissedResult(withoutDecision(data, id), decision) : data;
}

export function snoozeDecision(data: AppData, id: string): AppData {
  const decision = findDecision(data, id);
  return decision ? { ...withoutDecision(data, id), snoozed: [...data.snoozed, decision] } : data;
}

export function restoreSnoozed(data: AppData): AppData {
  return data.snoozed.length === 0 ? data : { ...data, decisions: [...data.decisions, ...data.snoozed], snoozed: [] };
}
