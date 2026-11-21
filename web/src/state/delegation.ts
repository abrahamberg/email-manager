import type { AppData, AutonomyLevel, Category, Rule, RuleAction, RuleCondition } from "../domain/types";
import { describeRule } from "../domain/rules";
import { newRule } from "./records";
import { PRESETS, levelForPreset, type PresetName } from "../domain/autonomy";

export function setRuleStatus(data: AppData, id: string, status: Rule["status"]): AppData {
  return { ...data, rules: data.rules.map((rule) => (rule.id === id ? { ...rule, status } : rule)) };
}

export function setPolicyLevel(data: AppData, category: Category, level: AutonomyLevel): AppData {
  return {
    ...data,
    policies: data.policies.map((policy) => (policy.category === category ? { ...policy, level } : policy)),
  };
}

export function recordCheck(data: AppData, category: Category, correct: boolean): AppData {
  return {
    ...data,
    policies: data.policies.map((policy) =>
      policy.category === category
        ? { ...policy, checked: policy.checked + 1, correct: policy.correct + (correct ? 1 : 0) }
        : policy,
    ),
  };
}

export function applyPreset(data: AppData, name: PresetName): AppData {
  const preset = PRESETS[name];
  return { ...data, policies: data.policies.map((policy) => ({ ...policy, level: levelForPreset(preset, policy) })) };
}

export function saveRule(data: AppData, id: string | undefined, when: RuleCondition[], then: RuleAction): AppData {
  const text = describeRule(when, then);
  const existing = data.rules.find((rule) => rule.id === id);
  if (existing) {
    return { ...data, rules: data.rules.map((rule) => (rule.id === id ? { ...rule, text, when, then } : rule)) };
  }
  return { ...data, rules: [{ ...newRule(text, "user", "active"), when, then }, ...data.rules] };
}
