import type { AppData } from "../domain/types";
import type { Action } from "./actions";
import { acceptDecision, dismissDecision, restoreSnoozed, snoozeDecision } from "./decisions";
import { answerQuickCheck, teachFromReceipt, undoReceipt } from "./receipts";
import { applyPreset, saveRule, setPolicyLevel, setRuleStatus } from "./delegation";
import { setDigestState, toggleTask, unsubscribeCategory, updateSettings } from "./library";

export function applyAction(data: AppData, action: Action): AppData {
  switch (action.type) {
    case "decision/accept": return acceptDecision(data, action.id, action.edit);
    case "decision/dismiss": return dismissDecision(data, action.id);
    case "decision/snooze": return snoozeDecision(data, action.id);
    case "decision/restoreSnoozed": return restoreSnoozed(data);
    case "quickCheck/answer": return answerQuickCheck(data, action.id, action.correct);
    case "receipt/undo": return undoReceipt(data, action.id);
    case "receipt/teach": return teachFromReceipt(data, action.id, action.always);
    case "digest/setState": return setDigestState(data, action.id, action.state);
    case "digest/unsubscribeCategory": return unsubscribeCategory(data, action.category);
    case "task/toggle": return toggleTask(data, action.id);
    case "policy/setLevel": return setPolicyLevel(data, action.category, action.level);
    case "policy/applyPreset": return applyPreset(data, action.preset);
    case "rule/setStatus": return setRuleStatus(data, action.id, action.status);
    case "rule/save": return saveRule(data, action.id, action.when, action.then);
    case "settings/update": return updateSettings(data, action.patch);
  }
}
