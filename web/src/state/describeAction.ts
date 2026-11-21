import type { AppData } from "../domain/types";
import { AUTONOMY_LABELS } from "../domain/autonomy";
import type { Action } from "./actions";

function senderOfDecision(data: AppData, id: string): string {
  return data.decisions.find((decision) => decision.id === id)?.email.from.name ?? "them";
}

export function describeAction(before: AppData, action: Action): string {
  switch (action.type) {
    case "decision/accept": return `Done for ${senderOfDecision(before, action.id)}`;
    case "decision/dismiss": return "Dismissed";
    case "decision/snooze": return `Snoozed until ${before.briefing.nextBriefing}`;
    case "quickCheck/answer": return action.correct ? "Thanks, noted" : "Undone. I proposed a rule so it won't happen again";
    case "receipt/undo": return "Undone";
    case "receipt/teach": return action.always ? "Rule added" : "Undone and rule added";
    case "digest/setState": return `Sender ${action.state}`;
    case "digest/unsubscribeCategory": return `Unsubscribed from all ${action.category} senders`;
    case "task/toggle": return "Task updated";
    case "policy/setLevel": return `Set to ${AUTONOMY_LABELS[action.level]}`;
    case "rule/setStatus": return `Rule ${action.status}`;
    case "settings/update": return "Settings saved";
  }
}
