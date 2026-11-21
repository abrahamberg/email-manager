import type { AutonomyLevel, Category, DigestGroup, Rule, Settings } from "../domain/types";

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
  | { type: "quickCheck/answer"; id: string; correct: boolean }
  | { type: "receipt/undo"; id: string }
  | { type: "receipt/teach"; id: string; always: boolean }
  | { type: "digest/setState"; id: string; state: DigestGroup["state"] }
  | { type: "digest/unsubscribeCategory"; category: Category }
  | { type: "task/toggle"; id: string }
  | { type: "policy/setLevel"; category: Category; level: AutonomyLevel }
  | { type: "rule/setStatus"; id: string; status: Rule["status"] }
  | { type: "settings/update"; patch: Partial<Settings> };
