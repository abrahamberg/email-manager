import type { AppData, AutonomyLevel, Category, Rule } from "../domain/types";

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
