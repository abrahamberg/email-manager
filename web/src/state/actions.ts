import type { PresetName } from "../domain/autonomy";
import type { AutonomyLevel, Category, DigestGroup, Rule, RuleAction, RuleCondition, Settings } from "../domain/types";

export interface DecisionEdit {
  text?: string;
  optionIndex?: number;
  title?: string;
  due?: string;
}

export type Action =
  | { type: "decision/accept"; id: string; edit?: DecisionEdit }
  | { type: "decision/dismiss"; id: string }
  | { type: "decision/snooze"; id: string }
  | { type: "decision/restoreSnoozed" }
  | { type: "quickCheck/answer"; id: string; correct: boolean }
  | { type: "receipt/undo"; id: string }
  | { type: "receipt/teach"; id: string; always: boolean }
  | { type: "digest/setState"; id: string; state: DigestGroup["state"] }
  | { type: "digest/unsubscribeCategory"; category: Category }
  | { type: "task/toggle"; id: string }
  | { type: "policy/setLevel"; category: Category; level: AutonomyLevel }
  | { type: "policy/applyPreset"; preset: PresetName }
  | { type: "rule/setStatus"; id: string; status: Rule["status"] }
  | { type: "rule/save"; id?: string; when: RuleCondition[]; then: RuleAction }
  | { type: "settings/update"; patch: Partial<Settings> }
  | { type: "pick/feedback"; streamId: string; itemId: string; feedback: "more" | "less" }
  | { type: "fact/forget"; id: string }
  | { type: "area/setNote"; id: string; note: string }
  | { type: "area/add"; name: string; note: string };
